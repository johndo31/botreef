interface StoryCardProps {
  story: {
    id: string;
    title: string;
    priority: number;
    assignee?: string | null;
    assigneeType?: string | null;
    storyPoints?: number | null;
  };
  onClick: () => void;
}

const priorityColors: Record<number, string> = {
  0: "bg-gray-700",
  1: "bg-blue-700",
  2: "bg-yellow-700",
  3: "bg-red-700",
};

export default function StoryCard({ story, onClick }: StoryCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded p-3 cursor-pointer hover:bg-gray-750 border border-gray-700 hover:border-gray-600 transition-colors"
    >
      <div className="text-sm font-medium mb-2">{story.title}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className={`px-1.5 py-0.5 rounded ${priorityColors[story.priority] ?? "bg-gray-700"}`}>
          P{story.priority}
        </span>
        {story.storyPoints && (
          <span className="text-gray-500">{story.storyPoints}pts</span>
        )}
        {story.assigneeType === "agent" && (
          <span className="text-reef-400 ml-auto">Agent</span>
        )}
        {story.assignee && story.assigneeType !== "agent" && (
          <span className="text-gray-400 ml-auto">{story.assignee}</span>
        )}
      </div>
    </div>
  );
}
