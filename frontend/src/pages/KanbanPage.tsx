import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import KanbanBoard from "../components/KanbanBoard";
import StoryEditor from "../components/StoryEditor";

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [board, setBoard] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingStory, setEditingStory] = useState<any>(null);

  const loadBoard = () => {
    if (!projectId) return;
    api.getBoard(projectId).then((r) => {
      setBoard(r.board);
      setStories(r.stories);
    }).catch(() => {});
  };

  useEffect(() => { loadBoard(); }, [projectId]);

  const handleCreateStory = async (data: any) => {
    if (!projectId) return;
    await api.createStory(projectId, data);
    setShowEditor(false);
    loadBoard();
  };

  const handleMoveStory = async (storyId: string, columnId: string) => {
    await api.updateStory(storyId, { columnId });
    loadBoard();
  };

  if (!board) return <div className="text-gray-400">Loading board...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{board.name}</h1>
        <button
          onClick={() => { setEditingStory(null); setShowEditor(true); }}
          className="bg-reef-600 hover:bg-reef-700 px-4 py-2 rounded text-sm font-medium"
        >
          New Story
        </button>
      </div>

      <KanbanBoard
        board={board}
        stories={stories}
        onMoveStory={handleMoveStory}
        onEditStory={(story) => { setEditingStory(story); setShowEditor(true); }}
      />

      {showEditor && (
        <StoryEditor
          board={board}
          story={editingStory}
          onSave={handleCreateStory}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
