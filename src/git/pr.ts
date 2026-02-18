import { Octokit } from "@octokit/rest";
import { logger } from "../util/logger.js";

export interface PullRequestOptions {
  repoUrl: string;
  branch: string;
  baseBranch: string;
  title: string;
  body: string;
  token?: string;
}

function parseGitHubRepo(repoUrl: string): { owner: string; repo: string } | null {
  // Handle SSH URLs: git@github.com:owner/repo.git
  const sshMatch = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (sshMatch) {
    return { owner: sshMatch[1]!, repo: sshMatch[2]! };
  }
  // Handle HTTPS URLs: https://github.com/owner/repo.git
  const httpsMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return { owner: httpsMatch[1]!, repo: httpsMatch[2]! };
  }
  return null;
}

export async function createPullRequest(options: PullRequestOptions): Promise<string | undefined> {
  const parsed = parseGitHubRepo(options.repoUrl);
  if (!parsed) {
    logger.warn({ repoUrl: options.repoUrl }, "Cannot create PR for non-GitHub repo");
    return undefined;
  }

  const token = options.token ?? process.env.GITHUB_TOKEN;
  if (!token) {
    logger.warn("No GitHub token available, skipping PR creation");
    return undefined;
  }

  const octokit = new Octokit({ auth: token });

  try {
    const { data: pr } = await octokit.pulls.create({
      owner: parsed.owner,
      repo: parsed.repo,
      title: options.title,
      body: options.body,
      head: options.branch,
      base: options.baseBranch,
    });

    logger.info({ prUrl: pr.html_url }, "Pull request created");
    return pr.html_url;
  } catch (err) {
    logger.error({ err, ...parsed }, "Failed to create pull request");
    return undefined;
  }
}
