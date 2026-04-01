import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { Input } from "./Input.js";
import { Button } from "./Button.js";
import styles from "./IngestForm.module.css";

interface UrlIngestFormProps {
  onJobCreated: (jobId: string) => void;
}

export function UrlIngestForm({ onJobCreated }: UrlIngestFormProps) {
  const [url, setUrl] = useState("");
  const [useBrowser, setUseBrowser] = useState(false);

  const mutation = trpc.ingest.fromUrl.useMutation({
    onSuccess: (data) => onJobCreated(data.jobId),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    mutation.mutate({ url: url.trim(), useBrowser });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.field}>
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/recipe"
          required
        />
      </div>
      <div className={styles.field}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={useBrowser}
            onChange={(e) => setUseBrowser(e.target.checked)}
          />
          Use browser rendering (for JavaScript-heavy sites)
        </label>
      </div>
      <Button type="submit" disabled={!url.trim() || mutation.isPending}>
        {mutation.isPending ? "Submitting..." : "Import Recipe"}
      </Button>
      {mutation.error && (
        <div className={styles.error}>{mutation.error.message}</div>
      )}
    </form>
  );
}
