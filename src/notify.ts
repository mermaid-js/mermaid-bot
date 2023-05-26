import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import * as dotenv from "dotenv";
import { readFileSync } from "fs";
dotenv.config();

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.APP_ID,
    privateKey: process.env.PRIVATE_KEY,
    installationId: process.env.INSTALLATION_ID,
  },
});

const data: Record<string, { prs: number[] }> = JSON.parse(
  readFileSync("eligibleUsers.json", "utf8")
);

const notify = async (user: string) => {
  const { prs } = data[user];
  const pr = prs[0];
  const res = await octokit.issues.createComment({
    owner: "mermaid-js",
    repo: "mermaid",
    issue_number: pr,
    body: `@${user}, Thank you for the contribution!
You are now eligible for a year of Premium account on [MermaidChart](https://www.mermaidchart.com). 
[Sign up](https://www.mermaidchart.com/app/sign-up) with your GitHub account to activate.`,
  });
  console.log(res);
};

const main = async () => {
  await notify("sidharthv96");
};

void main();
