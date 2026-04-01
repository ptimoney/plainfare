import { useState } from "react";
import { trpc } from "../lib/trpc.js";
import { Button } from "./Button.js";
import { FileUpload, type FileData } from "./FileUpload.js";
import styles from "./IngestForm.module.css";

interface ImageIngestFormProps {
  onJobCreated: (jobId: string) => void;
}

export function ImageIngestForm({ onJobCreated }: ImageIngestFormProps) {
  const [imageFile, setImageFile] = useState<FileData | null>(null);

  const mutation = trpc.ingest.fromImage.useMutation({
    onSuccess: (data) => onJobCreated(data.jobId),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile) return;
    mutation.mutate({
      image: imageFile.data,
      mimeType: imageFile.mimeType,
      filename: imageFile.name,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <FileUpload value={imageFile} onChange={setImageFile} />
      <Button type="submit" disabled={!imageFile || mutation.isPending}>
        {mutation.isPending ? "Submitting..." : "Extract Recipe"}
      </Button>
      {mutation.error && (
        <div className={styles.error}>{mutation.error.message}</div>
      )}
    </form>
  );
}
