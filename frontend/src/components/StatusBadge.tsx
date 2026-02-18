const statusConfig: Record<string, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-gray-700 text-gray-300" },
  cloning: { label: "Cloning", className: "bg-blue-900 text-blue-300" },
  running: { label: "Running", className: "bg-yellow-900 text-yellow-300" },
  committing: { label: "Committing", className: "bg-purple-900 text-purple-300" },
  pushing: { label: "Pushing", className: "bg-indigo-900 text-indigo-300" },
  awaiting_approval: { label: "Awaiting Approval", className: "bg-orange-900 text-orange-300" },
  completed: { label: "Completed", className: "bg-green-900 text-green-300" },
  failed: { label: "Failed", className: "bg-red-900 text-red-300" },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-gray-700 text-gray-300" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
