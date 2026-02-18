import { useState } from "react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState(localStorage.getItem("botreef_api_key") ?? "");

  const handleSave = () => {
    localStorage.setItem("botreef_api_key", apiKey);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="br_..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-reef-500"
          />
          <p className="text-xs text-gray-500 mt-1">Your Botreef API key for authenticating requests</p>
        </div>

        <button
          onClick={handleSave}
          className="bg-reef-600 hover:bg-reef-700 px-4 py-2 rounded text-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  );
}
