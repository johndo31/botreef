import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";

export function useTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listTasks()
      .then((r) => setTasks(r.tasks))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { tasks, loading, refresh };
}
