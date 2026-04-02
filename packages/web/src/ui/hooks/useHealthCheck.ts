import { useState, useEffect } from "react";

interface HealthResponse {
  status: string;
  recipes: number;
  ai: boolean;
  ytdlp: boolean;
}

export function useHealthCheck() {
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [ytdlpAvailable, setYtdlpAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((data) => {
        setAiAvailable(data.ai);
        setYtdlpAvailable(data.ytdlp);
        setLoading(false);
      })
      .catch(() => {
        setAiAvailable(false);
        setYtdlpAvailable(false);
        setLoading(false);
      });
  }, []);

  return { aiAvailable, ytdlpAvailable, loading };
}
