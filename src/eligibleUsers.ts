import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { writeFile } from "fs/promises";
import * as dotenv from "dotenv";
dotenv.config();

const octokit = new Octokit({
  authStrategy: createAppAuth,
  auth: {
    appId: process.env.APP_ID,
    privateKey: process.env.PRIVATE_KEY,
    installationId: process.env.INSTALLATION_ID,
  },
});

const isOlderThanAYear = (date: string | null) => {
  if (!date) {
    return false;
  }
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return new Date(date) < oneYearAgo;
};

const main = async () => {
  const pulls = await octokit.paginate(
    octokit.pulls.list,
    {
      owner: "mermaid-js",
      repo: "mermaid",
      state: "closed",
    },
    (response, done) => {
      if (response.data.some((pull) => isOlderThanAYear(pull.merged_at))) {
        done();
      }
      return response.data;
    }
  );
  // const pulls = await octokit.pulls.list({
  //   owner: "mermaid-js",
  //   repo: "mermaid",
  //   state: "closed",
  // });
  // console.log(pulls);
  const users = new Set<string>();
  const data: Record<string, { prs: number[] }> = {};
  for (const pull of pulls) {
    if (isOlderThanAYear(pull.merged_at)) {
      break;
    }
    const username = pull.user?.login;
    if (!username || username.includes("[bot]") || username.endsWith("-bot")) {
      continue;
    }
    if (users.has(username)) {
      data[username].prs.push(pull.number);
      continue;
    } else {
      data[username] = {
        prs: [pull.number],
      };
    }
    users.add(username);
    console.log(`${username}:${pull.number}`);
  }
  console.log(data);
  await writeFile("eligibleUsers.json", JSON.stringify(data, null, 2), "utf8");
};

void main();
