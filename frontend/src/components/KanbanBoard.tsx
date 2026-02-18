import { DndContext, type DragEndEvent, closestCenter } from "@dnd-kit/core";
import StoryCard from "./StoryCard";

interface KanbanBoardProps {
  board: { columns: Array<{ id: string; name: string }> };
  stories: Array<{ id: string; columnId: string; title: string; priority: number; assignee?: string; assigneeType?: string }>;
  onMoveStory: (storyId: string, columnId: string) => void;
  onEditStory: (story: any) => void;
}

export default function KanbanBoard({ board, stories, onMoveStory, onEditStory }: KanbanBoardProps) {
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onMoveStory(String(active.id), String(over.id));
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.columns.map((column) => {
          const columnStories = stories.filter((s) => s.columnId === column.id);
          return (
            <div
              key={column.id}
              id={column.id}
              className="flex-shrink-0 w-72 bg-gray-900 rounded-lg border border-gray-800"
            >
              <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-medium text-sm">{column.name}</h3>
                <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                  {columnStories.length}
                </span>
              </div>
              <div className="p-2 space-y-2 min-h-[200px]">
                {columnStories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onClick={() => onEditStory(story)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}
