import type { Octokit } from "@octokit/core";

const regex = /\n\n<!-- probot = (.*) -->/;

type StringOrNumber = number | string;
type Key = string;
type Value =
  | { [key: string]: StringOrNumber }
  | StringOrNumber[]
  | StringOrNumber;

interface IssueSelector {
  owner: string;
  repo: string;
  issue_number: number;
}

const getIssueBody = async (issueSelector: IssueSelector, github: Octokit) => {
  const body =
    (
      await github.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
        ...issueSelector,
      })
    ).data.body || "";
  return body;
};

export const metadata = async (
  github: Octokit,
  issueSelector: IssueSelector
) => {
  const prefix = "mermaid-bot";

  return {
    async get(key: Key) {
      const body = await getIssueBody(issueSelector, github);
      const match = body.match(regex);
      if (match) {
        const data = JSON.parse(match[1])[prefix];
        return key ? data && data[key] : data;
      }
    },

    async set(key: Key, value: Value) {
      let body = await getIssueBody(issueSelector, github);
      let data: any = {};
      body = body.replace(regex, (_, json) => {
        data = JSON.parse(json);
        return "";
      });

      if (!data[prefix]) {
        data[prefix] = {};
      }

      if (typeof key === "object") {
        Object.assign(data[prefix], key);
      } else {
        data[prefix][key] = value;
      }

      body = `${body}\n\n<!-- probot = ${JSON.stringify(data)} -->`;
      return github.request(
        "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
        { ...issueSelector, body }
      );
    },
  };
};
