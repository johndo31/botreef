import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";

interface TaskListProps {
  tasks: Array<{ id: string; instruction: string; status: string; createdAt: string; projectId: string }>;
}

export default function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) {
    return <div className="text-gray-500 text-sm">No tasks yet</div>;
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Link
          key={task.id}
          to={`/tasks/${task.id}`}
          className="block bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center justify-between mb-1">
            <code className="text-xs text-gray-500">{task.id.slice(0, 8)}</code>
            <StatusBadge status={task.status} />
          </div>
          <div className="text-sm truncate">{task.instruction}</div>
          <div className="text-xs text-gray-500 mt-1">{task.projectId}</div>
        </Link>
      ))}
    </div>
  );
}
