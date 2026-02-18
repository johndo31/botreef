import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import TaskList from "../components/TaskList";
import ProjectList from "../components/ProjectList";

export default function Dashboard() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    api.listTasks().then((r) => setTasks(r.tasks)).catch(() => {});
    api.listProjects().then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">Botreef autonomous coding server</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold">{projects.length}</div>
          <div className="text-gray-400 text-sm">Projects</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold">{tasks.filter((t) => t.status === "running").length}</div>
          <div className="text-gray-400 text-sm">Active Tasks</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold">{tasks.filter((t) => t.status === "completed").length}</div>
          <div className="text-gray-400 text-sm">Completed</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-lg font-semibold mb-4">Projects</h2>
          <ProjectList projects={projects} />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Tasks</h2>
          <TaskList tasks={tasks.slice(0, 10)} />
        </div>
      </div>
    </div>
  );
}
