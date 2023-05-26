import { App } from "@octokit/app";
import { verifyWebhookSignature } from "./verify";

/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `wrangler dev src/index.ts` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `wrangler publish src/index.ts --name my-worker` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  USERS: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
  //
  // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
  // MY_SERVICE: Fetcher;
  APP_ID: string;
  WEBHOOK_SECRET: string;
  PRIVATE_KEY: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // wrangler secret put APP_ID
    const appId = env.APP_ID;
    // wrangler secret put WEBHOOK_SECRET
    const secret = env.WEBHOOK_SECRET;

    // The private-key.pem file from GitHub needs to be transformed from the
    // PKCS#1 format to PKCS#8, as the crypto APIs do not support PKCS#1:
    //
    //     openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private-key.pem -out private-key-pkcs8.pem
    //
    // Then set the private key
    //
    //     cat private-key-pkcs8.pem | npx wrangler secret put PRIVATE_KEY
    //
    const privateKey = env.PRIVATE_KEY;

    const app = new App({
      appId,
      privateKey,
      webhooks: {
        secret,
      },
    });

    app.webhooks.on("pull_request.closed", async ({ octokit, payload }) => {
      const username = payload.pull_request.user.login;
      const merged = payload.pull_request.merged;
      const exists = await env.USERS.get(username);
      if (exists || !merged) {
        return;
      }
      await octokit.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner: payload.repository.owner.login,
          repo: payload.repository.name,
          issue_number: payload.pull_request.number,
          body: `@${username}, Thank you for the contribution!
You are now eligible for a year of Premium account on [MermaidChart](https://www.mermaidchart.com). 
[Sign up](https://www.mermaidchart.com/app/sign-up) with your GitHub account to activate.`,
        }
      );
      await env.USERS.put(username, payload.pull_request.number.toString());
    });

    if (request.method === "GET") {
      const { data } = await app.octokit.request("GET /app");

      return new Response(
        `<h1>Cloudflare Worker Example GitHub app</h1>
<p>Installation count: ${data.installations_count}</p>
<p><a href="https://github.com/apps/cloudflare-worker-example">Install</a> | <a href="https://github.com/gr2m/cloudflare-worker-github-app-example/#readme">source code</a></p>`,
        {
          headers: { "content-type": "text/html" },
        }
      );
    }

    const id = request.headers.get("x-github-delivery");
    const name = request.headers.get("x-github-event");
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    const payloadString = await request.text();

    // Verify webhook signature
    try {
      await verifyWebhookSignature(payloadString, signature, secret);
    } catch (error) {
      // @ts-ignore
      const errorMessage = error.message;
      app.log.warn(errorMessage);
      return new Response(`{ "error": "${errorMessage}" }`, {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const payload = JSON.parse(payloadString);
    // Now handle the request
    try {
      if (!id || !name || !payload) {
        throw new Error("Missing required parameters");
      }

      await app.webhooks.receive({
        id,
        // @ts-ignore
        name,
        payload,
      });

      return new Response(`{ "ok": true }`, {
        headers: { "content-type": "application/json" },
      });
    } catch (error) {
      // @ts-ignore
      const errorMessage = error.message;
      app.log.error(errorMessage);
      return new Response(`{ "error": "${errorMessage}" }`, {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },
};
