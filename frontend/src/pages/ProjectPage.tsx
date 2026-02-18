import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import TaskList from "../components/TaskList";
import ProjectSettings from "../components/ProjectSettings";

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!projectId) return;
    api.getProject(projectId).then(setProject).catch(() => {});
    api.listTasks().then((r) => setTasks(r.tasks.filter((t: any) => t.projectId === projectId))).catch(() => {});
  }, [projectId]);

  if (!project) return <div className="text-gray-400">Loading project...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-gray-400 text-sm">{project.repoUrl}</p>
        </div>
        <Link
          to={`/kanban/${projectId}`}
          className="bg-reef-600 hover:bg-reef-700 px-4 py-2 rounded text-sm font-medium"
        >
          Kanban Board
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Tasks</h2>
          <TaskList tasks={tasks} />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-4">Settings</h2>
          <ProjectSettings project={project} />
        </div>
      </div>
    </div>
  );
}
