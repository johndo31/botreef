import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

export function useKanban(projectId: string | undefined) {
  const [board, setBoard] = useState<any>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!projectId) return;
    setLoading(true);
    api.getBoard(projectId)
      .then((r) => {
        setBoard(r.board);
        setStories(r.stories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const moveStory = useCallback(async (storyId: string, columnId: string) => {
    await api.updateStory(storyId, { columnId });
    refresh();
  }, [refresh]);

  const addStory = useCallback(async (data: any) => {
    if (!projectId) return;
    await api.createStory(projectId, data);
    refresh();
  }, [projectId, refresh]);

  return { board, stories, loading, refresh, moveStory, addStory };
}
