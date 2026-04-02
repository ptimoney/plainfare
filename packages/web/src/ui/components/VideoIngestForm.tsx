import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { Input } from "./Input.js";
import { Button } from "./Button.js";
import styles from "./IngestForm.module.css";

interface VideoIngestFormProps {
  onJobCreated: (jobId: string) => void;
}

export function VideoIngestForm({ onJobCreated }: VideoIngestFormProps) {
  const [url, setUrl] = useState("");

  const mutation = trpc.ingest.fromVideo.useMutation({
    onSuccess: (data) => onJobCreated(data.jobId),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    mutation.mutate({ url: url.trim() });
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className={styles.hint}>
        Paste a video URL to extract the recipe (YouTube, TikTok, Instagram).
      </p>
      <div className={styles.field}>
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=... or TikTok/Instagram link"
          required
        />
      </div>
      <Button type="submit" disabled={!url.trim() || mutation.isPending}>
        {mutation.isPending ? "Submitting..." : "Extract Recipe"}
      </Button>
      {mutation.error && (
        <div className={styles.error}>{mutation.error.message}</div>
      )}
    </form>
  );
}
