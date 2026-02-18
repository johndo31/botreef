import { useState, useEffect } from "react";
import { apiClient } from "../api/client";

interface Bot {
  id: string;
  name: string;
  projectId: string;
  engineType: string;
  model: string | null;
  systemPrompt: string | null;
  status: string;
  pollIntervalSeconds: number;
  maxConcurrentStories: number;
  idleBehavior: string;
  createdAt: string;
  updatedAt: string;
}

interface JournalEntry {
  id: string;
  botId: string;
  jobId: string | null;
  entryType: string;
  summary: string;
  details: string | null;
  createdAt: string;
}

export function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadBots();
  }, []);

  async function loadBots() {
    const data = await apiClient.get<{ bots: Bot[] }>("/api/v1/bots");
    setBots(data.bots);
  }

  async function loadJournal(botId: string) {
    const data = await apiClient.get<{ entries: JournalEntry[] }>(
      `/api/v1/bots/${botId}/journal?limit=30`
    );
    setJournal(data.entries);
  }

  async function selectBot(bot: Bot) {
    setSelectedBot(bot);
    await loadJournal(bot.id);
  }

  async function toggleBotStatus(bot: Bot) {
    const newStatus = bot.status === "stopped" || bot.status === "paused" ? "idle" : "paused";
    await apiClient.patch(`/api/v1/bots/${bot.id}`, { status: newStatus });
    await loadBots();
  }

  async function deleteBot(botId: string) {
    await apiClient.delete(`/api/v1/bots/${botId}`);
    if (selectedBot?.id === botId) {
      setSelectedBot(null);
      setJournal([]);
    }
    await loadBots();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bots</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Bot
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bot list */}
        <div className="lg:col-span-1 space-y-3">
          {bots.map((bot) => (
            <div
              key={bot.id}
              onClick={() => selectBot(bot)}
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                selectedBot?.id === bot.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{bot.name}</h3>
                <StatusBadge status={bot.status} />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {bot.engineType} · {bot.projectId}
              </p>
            </div>
          ))}
          {bots.length === 0 && (
            <p className="text-gray-500 text-center py-8">No bots yet. Create one to get started.</p>
          )}
        </div>

        {/* Bot detail + journal */}
        <div className="lg:col-span-2">
          {selectedBot ? (
            <div className="space-y-6">
              <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">{selectedBot.name}</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleBotStatus(selectedBot)}
                      className={`px-3 py-1 rounded text-sm ${
                        selectedBot.status === "idle" || selectedBot.status === "working"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {selectedBot.status === "idle" || selectedBot.status === "working" ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => deleteBot(selectedBot.id)}
                      className="px-3 py-1 rounded text-sm bg-red-100 text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Engine</dt>
                    <dd className="font-medium">{selectedBot.engineType}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Model</dt>
                    <dd className="font-medium">{selectedBot.model ?? "default"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Poll Interval</dt>
                    <dd className="font-medium">{selectedBot.pollIntervalSeconds}s</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Max Concurrent</dt>
                    <dd className="font-medium">{selectedBot.maxConcurrentStories}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Idle Behavior</dt>
                    <dd className="font-medium">{selectedBot.idleBehavior}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Project</dt>
                    <dd className="font-medium">{selectedBot.projectId}</dd>
                  </div>
                </dl>

                {selectedBot.systemPrompt && (
                  <div className="mt-4">
                    <dt className="text-gray-500 text-sm">System Prompt</dt>
                    <dd className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm font-mono whitespace-pre-wrap">
                      {selectedBot.systemPrompt}
                    </dd>
                  </div>
                )}
              </div>

              {/* Journal */}
              <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold mb-4">Activity Journal</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {journal.map((entry) => (
                    <div key={entry.id} className="flex gap-3 text-sm">
                      <EntryIcon type={entry.entryType} />
                      <div className="flex-1">
                        <p>{entry.summary}</p>
                        <p className="text-gray-400 text-xs mt-1">
                          {new Date(entry.createdAt).toLocaleString()}
                          {entry.jobId && ` · Job ${entry.jobId.slice(0, 8)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                  {journal.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No activity yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Select a bot to view details
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreateBotModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadBots(); }} />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: "bg-green-100 text-green-800",
    working: "bg-blue-100 text-blue-800",
    paused: "bg-yellow-100 text-yellow-800",
    stopped: "bg-gray-100 text-gray-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  );
}

function EntryIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    task_started: ">>",
    task_completed: "ok",
    task_failed: "!!",
    observation: "**",
    decision: "->",
    learning: "++",
  };
  return (
    <span className="text-xs font-mono text-gray-400 w-6 shrink-0 pt-0.5">
      {icons[type] ?? "--"}
    </span>
  );
}

function CreateBotModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [engineType, setEngineType] = useState<"claude-code" | "codex">("claude-code");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post("/api/v1/bots", {
        name,
        projectId,
        engineType,
        systemPrompt: systemPrompt || undefined,
      });
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md space-y-4"
      >
        <h2 className="text-lg font-bold">Create Bot</h2>

        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Project ID</label>
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Engine</label>
          <select
            value={engineType}
            onChange={(e) => setEngineType(e.target.value as "claude-code" | "codex")}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="claude-code">Claude Code</option>
            <option value="codex">Codex</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            rows={4}
            placeholder="Custom instructions for this bot..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name || !projectId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
