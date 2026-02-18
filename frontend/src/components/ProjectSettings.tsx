interface ProjectSettingsProps {
  project: any;
}

export default function ProjectSettings({ project }: ProjectSettingsProps) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-400">Repository</span>
        <span className="text-white">{project.repoUrl}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Default Branch</span>
        <code className="text-green-400">{project.defaultBranch}</code>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Branch Strategy</span>
        <span>{project.branchStrategy}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Auto Push</span>
        <span>{project.autoPush ? "Yes" : "No"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Auto Create PR</span>
        <span>{project.autoCreatePr ? "Yes" : "No"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Require Approval</span>
        <span>{project.requireApproval ? "Yes" : "No"}</span>
      </div>
    </div>
  );
}
