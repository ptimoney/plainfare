import { useState, useEffect } from "react";

interface HealthResponse {
  status: string;
  recipes: number;
  ai: boolean;
}

export function useHealthCheck() {
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((data) => {
        setAiAvailable(data.ai);
        setLoading(false);
      })
      .catch(() => {
        setAiAvailable(false);
        setLoading(false);
      });
  }, []);

  return { aiAvailable, loading };
}
