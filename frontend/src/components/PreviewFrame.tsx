interface PreviewFrameProps {
  url: string;
}

export default function PreviewFrame({ url }: PreviewFrameProps) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="bg-gray-800 px-3 py-2 flex items-center gap-2 border-b border-gray-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 bg-gray-900 rounded px-2 py-1 text-xs text-gray-400 truncate">
          {url}
        </div>
      </div>
      <iframe
        src={url}
        className="w-full h-96 bg-white"
        sandbox="allow-scripts allow-same-origin"
        title="Dev Server Preview"
      />
    </div>
  );
}
