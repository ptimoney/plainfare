import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { Textarea } from "./Input.js";
import { Button } from "./Button.js";
import styles from "./IngestForm.module.css";

interface TextIngestFormProps {
  onJobCreated: (jobId: string) => void;
}

export function TextIngestForm({ onJobCreated }: TextIngestFormProps) {
  const [text, setText] = useState("");

  const mutation = trpc.ingest.fromText.useMutation({
    onSuccess: (data) => onJobCreated(data.jobId),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    mutation.mutate({ text: text.trim() });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.field}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste recipe text here..."
          rows={10}
          required
        />
      </div>
      <Button type="submit" disabled={!text.trim() || mutation.isPending}>
        {mutation.isPending ? "Submitting..." : "Extract Recipe"}
      </Button>
      {mutation.error && (
        <div className={styles.error}>{mutation.error.message}</div>
      )}
    </form>
  );
}
