import { Link } from "react-router-dom";

interface ProjectListProps {
  projects: Array<{ id: string; name: string; repoUrl: string; defaultBranch: string }>;
}

export default function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return <div className="text-gray-500 text-sm">No projects configured</div>;
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <Link
          key={project.id}
          to={`/projects/${project.id}`}
          className="block bg-gray-900 rounded-lg p-3 border border-gray-800 hover:border-gray-700 transition-colors"
        >
          <div className="font-medium text-sm">{project.name}</div>
          <div className="text-xs text-gray-500 mt-1">{project.repoUrl}</div>
        </Link>
      ))}
    </div>
  );
}
