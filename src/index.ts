import { Probot } from "probot";
import metadata from "probot-metadata";

export = (app: Probot) => {
  app.on("pull_request.closed", async (context) => {
    const kv = metadata(context, {
      owner: "mermaid-js",
      repo: "mermaid",
      issue_number: 4260,
      body: "",
    });
    // const kv = metadata(context, {
    //   owner: "sidharthv96",
    //   repo: "mermaid",
    //   issue_number: 148,
    //   body: "",
    // });
    const username = context.payload.pull_request.user.login;
    const exists = await kv.get(username);
    if (exists) {
      return;
    }
    const issueComment = context.issue({
      body: `@${username}, Thank you for the contribution!
You are now eligible for a year of Premium account on [MermaidChart](https://www.mermaidchart.com). 
[Sign up](https://www.mermaidchart.com/app/sign-up) with your GitHub account to activate.`,
    });
    await context.octokit.issues.createComment(issueComment);
    await kv.set(username, { pr: context.payload.pull_request.number });
  });
};
