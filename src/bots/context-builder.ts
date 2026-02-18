import type { Bot } from "./manager.js";
import type { JournalEntry } from "./journal.js";
import { getRecentJournal } from "./journal.js";

export interface BotContext {
  preamble: string;
  recentEntries: JournalEntry[];
}

export function buildBotContext(bot: Bot, maxEntries: number = 5): BotContext {
  const recentEntries = getRecentJournal(bot.id, maxEntries);

  const parts: string[] = [];

  parts.push(`You are "${bot.name}", a bot working on this project.`);

  if (bot.systemPrompt) {
    parts.push(`\n## Instructions\n${bot.systemPrompt}`);
  }

  if (recentEntries.length > 0) {
    parts.push("\n## Recent Activity");
    const chronological = [...recentEntries].reverse();
    for (const entry of chronological) {
      const timestamp = entry.createdAt.split("T")[0];
      const prefix = entryPrefix(entry.entryType);
      parts.push(`- [${timestamp}] ${prefix}: ${entry.summary}`);
    }
  }

  const learnings = recentEntries.filter((e) => e.entryType === "learning");
  if (learnings.length > 0) {
    parts.push("\n## Things You've Learned");
    for (const l of learnings) {
      parts.push(`- ${l.summary}`);
    }
  }

  parts.push("\n## Current Task\n");

  return {
    preamble: parts.join("\n"),
    recentEntries,
  };
}

function entryPrefix(type: string): string {
  switch (type) {
    case "task_started": return "Started";
    case "task_completed": return "Completed";
    case "task_failed": return "Failed";
    case "observation": return "Observed";
    case "decision": return "Decided";
    case "learning": return "Learned";
    default: return type;
  }
}

export function buildInstructionWithContext(bot: Bot, instruction: string): string {
  const { preamble } = buildBotContext(bot);
  return `${preamble}${instruction}`;
}
