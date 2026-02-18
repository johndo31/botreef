import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function Sidebar() {
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    api.listProjects().then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded text-sm ${isActive ? "bg-reef-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`;

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold text-reef-400">Botreef</h1>
        <p className="text-xs text-gray-500">Autonomous Coding Server</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <NavLink to="/" className={linkClass} end>Dashboard</NavLink>

        {projects.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase px-3 mb-2">Projects</div>
            {projects.map((p) => (
              <NavLink key={p.id} to={`/projects/${p.id}`} className={linkClass}>
                {p.name}
              </NavLink>
            ))}
          </div>
        )}

        {projects.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase px-3 mb-2">Boards</div>
            {projects.map((p) => (
              <NavLink key={`board-${p.id}`} to={`/kanban/${p.id}`} className={linkClass}>
                {p.name}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <NavLink to="/settings" className={linkClass}>Settings</NavLink>
      </div>
    </aside>
  );
}
