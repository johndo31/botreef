export interface ParsedGitHubEvent {
  id: string;
  type: string;
  userId: string;
  userName: string;
  projectId: string;
  instruction: string;
}

const TRIGGER_PATTERN = /@botreef\s+(.+)/i;

export function parseGitHubEvent(
  eventType: string,
  payload: Record<string, unknown>,
): ParsedGitHubEvent | null {
  switch (eventType) {
    case "issue_comment":
      return parseIssueComment(payload);
    case "pull_request_review_comment":
      return parsePRComment(payload);
    case "issues":
      return parseIssue(payload);
    default:
      return null;
  }
}

function parseIssueComment(payload: Record<string, unknown>): ParsedGitHubEvent | null {
  const action = payload.action as string;
  if (action !== "created") return null;

  const comment = payload.comment as Record<string, unknown>;
  const body = comment?.body as string;
  if (!body) return null;

  const match = body.match(TRIGGER_PATTERN);
  if (!match) return null;

  const repo = payload.repository as Record<string, unknown>;
  const user = comment.user as Record<string, unknown>;

  return {
    id: String(comment.id),
    type: "issue_comment",
    userId: String(user?.id ?? ""),
    userName: (user?.login as string) ?? "",
    projectId: (repo?.name as string) ?? "",
    instruction: match[1]!.trim(),
  };
}

function parsePRComment(payload: Record<string, unknown>): ParsedGitHubEvent | null {
  const action = payload.action as string;
  if (action !== "created") return null;

  const comment = payload.comment as Record<string, unknown>;
  const body = comment?.body as string;
  if (!body) return null;

  const match = body.match(TRIGGER_PATTERN);
  if (!match) return null;

  const repo = payload.repository as Record<string, unknown>;
  const user = comment.user as Record<string, unknown>;

  return {
    id: String(comment.id),
    type: "pr_comment",
    userId: String(user?.id ?? ""),
    userName: (user?.login as string) ?? "",
    projectId: (repo?.name as string) ?? "",
    instruction: match[1]!.trim(),
  };
}

function parseIssue(payload: Record<string, unknown>): ParsedGitHubEvent | null {
  const action = payload.action as string;
  if (action !== "opened" && action !== "labeled") return null;

  const issue = payload.issue as Record<string, unknown>;
  const labels = (issue?.labels as Array<Record<string, unknown>>) ?? [];
  const hasBotreefLabel = labels.some((l) => (l.name as string)?.toLowerCase() === "botreef");

  if (!hasBotreefLabel) return null;

  const repo = payload.repository as Record<string, unknown>;
  const user = issue.user as Record<string, unknown>;

  return {
    id: String(issue.id),
    type: "issue",
    userId: String(user?.id ?? ""),
    userName: (user?.login as string) ?? "",
    projectId: (repo?.name as string) ?? "",
    instruction: `${issue.title}\n\n${issue.body ?? ""}`.trim(),
  };
}
