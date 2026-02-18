import { useState } from "react";

interface StoryEditorProps {
  board: { columns: Array<{ id: string; name: string }> };
  story?: any;
  onSave: (data: any) => void;
  onClose: () => void;
}

export default function StoryEditor({ board, story, onSave, onClose }: StoryEditorProps) {
  const [title, setTitle] = useState(story?.title ?? "");
  const [description, setDescription] = useState(story?.description ?? "");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(story?.acceptanceCriteria ?? "");
  const [columnId, setColumnId] = useState(story?.columnId ?? board.columns[0]?.id ?? "");
  const [priority, setPriority] = useState(story?.priority ?? 0);
  const [storyPoints, setStoryPoints] = useState(story?.storyPoints ?? "");
  const [assigneeType, setAssigneeType] = useState(story?.assigneeType ?? "agent");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      columnId,
      title,
      description: description || undefined,
      acceptanceCriteria: acceptanceCriteria || undefined,
      priority,
      storyPoints: storyPoints ? Number(storyPoints) : undefined,
      assigneeType,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-lg space-y-4"
      >
        <h2 className="text-lg font-bold">{story ? "Edit Story" : "New Story"}</h2>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-reef-500" />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-reef-500" />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Acceptance Criteria</label>
          <textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-reef-500" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Column</label>
            <select value={columnId} onChange={(e) => setColumnId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white">
              {board.columns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white">
              <option value={0}>P0 - Low</option>
              <option value={1}>P1 - Medium</option>
              <option value={2}>P2 - High</option>
              <option value={3}>P3 - Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Story Points</label>
            <input type="number" value={storyPoints} onChange={(e) => setStoryPoints(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Assignee</label>
            <select value={assigneeType} onChange={(e) => setAssigneeType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white">
              <option value="agent">Agent (autonomous)</option>
              <option value="user">User (manual)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
          <button type="submit"
            className="bg-reef-600 hover:bg-reef-700 px-4 py-2 rounded text-sm font-medium">
            {story ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
