import StatusBadge from "./StatusBadge";

interface TaskDetailProps {
  task: any;
}

export default function TaskDetail({ task }: TaskDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold">Task {task.id?.slice(0, 8)}</h2>
        <StatusBadge status={task.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Project:</span> {task.projectId}
        </div>
        <div>
          <span className="text-gray-400">Channel:</span> {task.channel}
        </div>
        {task.branch && (
          <div>
            <span className="text-gray-400">Branch:</span> <code className="text-green-400">{task.branch}</code>
          </div>
        )}
        {task.commitSha && (
          <div>
            <span className="text-gray-400">Commit:</span> <code>{task.commitSha.slice(0, 8)}</code>
          </div>
        )}
        {task.durationMs && (
          <div>
            <span className="text-gray-400">Duration:</span> {(task.durationMs / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      {task.output && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-1">Output</h3>
          <pre className="bg-gray-900 rounded p-3 text-xs overflow-auto max-h-96 border border-gray-800">
            {task.output}
          </pre>
        </div>
      )}

      {task.error && (
        <div>
          <h3 className="text-sm font-medium text-red-400 mb-1">Error</h3>
          <pre className="bg-red-950 rounded p-3 text-xs text-red-300 border border-red-900">
            {task.error}
          </pre>
        </div>
      )}
    </div>
  );
}
