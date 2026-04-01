import { useState, useRef } from "react";
import styles from "./FileUpload.module.css";

interface FileData {
  data: string;
  mimeType: string;
  name: string;
}

interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  value: FileData | null;
  onChange: (file: FileData | null) => void;
}

export function FileUpload({ accept = "image/*", maxSizeMB = 10, value, onChange }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File must be under ${maxSizeMB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const commaIdx = dataUrl.indexOf(",");
      const mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
      const data = dataUrl.slice(commaIdx + 1);
      onChange({ data, mimeType, name: file.name });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`${styles.dropZone} ${dragOver ? styles.active : ""}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
      {value ? (
        <div>
          <div className={styles.fileName}>{value.name}</div>
          <div className={styles.hint}>Click or drag to replace</div>
        </div>
      ) : (
        <div className={styles.placeholder}>
          Drag and drop an image, or click to select
        </div>
      )}
    </div>
  );
}

export type { FileData };
