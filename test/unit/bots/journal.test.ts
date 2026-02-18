import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRun = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);

vi.mock("../../../src/db/client.js", () => ({
  getDb: () => ({
    insert: () => ({
      values: () => ({
        run: mockRun,
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              all: mockAll,
            }),
            all: mockAll,
          }),
          all: mockAll,
        }),
      }),
    }),
  }),
}));

vi.mock("../../../src/util/id.js", () => ({
  generateId: () => "journal-test-123",
}));

import { writeJournalEntry, getRecentJournal, getJournalByJob, getJournalByType } from "../../../src/bots/journal.js";

describe("Bot Journal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writeJournalEntry inserts with generated id", () => {
    const entry = writeJournalEntry({
      botId: "bot-1",
      entryType: "task_completed",
      summary: "Did a thing",
    });

    expect(entry.id).toBe("journal-test-123");
    expect(entry.botId).toBe("bot-1");
    expect(entry.entryType).toBe("task_completed");
    expect(entry.summary).toBe("Did a thing");
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it("writeJournalEntry includes optional fields", () => {
    const entry = writeJournalEntry({
      botId: "bot-1",
      jobId: "job-1",
      entryType: "learning",
      summary: "Learned something",
      details: "Detailed explanation",
      storyId: "story-1",
    });

    expect(entry.jobId).toBe("job-1");
    expect(entry.details).toBe("Detailed explanation");
    expect(entry.storyId).toBe("story-1");
  });

  it("getRecentJournal returns entries", () => {
    const entries = [
      { id: "j-1", botId: "bot-1", entryType: "task_completed", summary: "Done" },
    ];
    mockAll.mockReturnValueOnce(entries);

    const result = getRecentJournal("bot-1", 10);
    expect(result).toEqual(entries);
  });

  it("getJournalByJob returns entries for a job", () => {
    mockAll.mockReturnValueOnce([]);
    const result = getJournalByJob("job-1");
    expect(result).toEqual([]);
  });

  it("getJournalByType filters by type", () => {
    const entries = [
      { id: "j-1", botId: "bot-1", entryType: "learning", summary: "Learned" },
    ];
    mockAll.mockReturnValueOnce(entries);

    const result = getJournalByType("bot-1", "learning", 5);
    expect(result).toEqual(entries);
  });
});
