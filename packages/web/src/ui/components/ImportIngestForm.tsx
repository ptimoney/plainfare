import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { Button } from "./Button.js";
import { FileUpload, type FileData } from "./FileUpload.js";
import styles from "./IngestForm.module.css";

interface ImportIngestFormProps {
  onJobCreated: (jobId: string) => void;
}

export function ImportIngestForm({ onJobCreated }: ImportIngestFormProps) {
  const [file, setFile] = useState<FileData | null>(null);

  const mutation = trpc.ingest.fromImport.useMutation({
    onSuccess: (data) => onJobCreated(data.jobId),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    mutation.mutate({
      data: file.data,
      filename: file.name,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className={styles.hint}>
        Upload a Paprika (.paprikarecipes) or CopyMeThat (.zip) export file.
      </p>
      <FileUpload
        accept=".paprikarecipes,.zip"
        maxSizeMB={50}
        value={file}
        onChange={setFile}
      />
      <Button type="submit" disabled={!file || mutation.isPending}>
        {mutation.isPending ? "Importing..." : "Import Recipes"}
      </Button>
      {mutation.error && (
        <div className={styles.error}>{mutation.error.message}</div>
      )}
    </form>
  );
}
