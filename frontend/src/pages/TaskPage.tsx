import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api, createSSEStream } from "../api/client";
import Terminal from "../components/Terminal";
import PreviewFrame from "../components/PreviewFrame";
import StatusBadge from "../components/StatusBadge";

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<any>(null);
  const [output, setOutput] = useState<string[]>([]);

  useEffect(() => {
    if (!taskId) return;
    api.getTask(taskId).then(setTask).catch(() => {});

    const es = createSSEStream(taskId, (event) => {
      if (event.output) {
        setOutput((prev) => [...prev, event.output]);
      }
      if (event.type === "task:completed" || event.type === "task:failed") {
        api.getTask(taskId).then(setTask).catch(() => {});
      }
    });

    return () => es.close();
  }, [taskId]);

  if (!task) return <div className="text-gray-400">Loading task...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Task {taskId?.slice(0, 8)}</h1>
        <StatusBadge status={task.status} />
      </div>

      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="text-sm text-gray-400 mb-1">Instruction</div>
        <div className="text-white">{task.instruction}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {task.prUrl && (
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400 mb-1">Pull Request</div>
            <a href={task.prUrl} target="_blank" rel="noopener" className="text-reef-400 hover:underline">
              {task.prUrl}
            </a>
          </div>
        )}
        {task.branch && (
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400 mb-1">Branch</div>
            <code className="text-green-400">{task.branch}</code>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Live Output</h2>
        <Terminal lines={output} />
      </div>

      {task.previewUrl && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Preview</h2>
          <PreviewFrame url={task.previewUrl} />
        </div>
      )}
    </div>
  );
}
