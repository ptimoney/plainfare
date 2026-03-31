import { Link } from "react-router-dom";
import { useJobPolling } from "../hooks/useJobPolling.js";

interface JobProgressProps {
  jobId: string | null;
  onReset: () => void;
}

interface IngestOutput {
  slug: string;
  recipe: { title: string };
}

export function JobProgress({ jobId, onReset }: JobProgressProps) {
  const { job, isPolling, isComplete, isFailed } = useJobPolling(jobId);

  if (!jobId || !job) return null;

  if (isPolling) {
    const status = job.status === "pending" ? "Queued..." : "Extracting recipe...";
    return (
      <div style={{ marginTop: "1.5rem" }}>
        <div style={{ marginBottom: "0.5rem", fontSize: "0.9rem", color: "#444" }}>
          {status} {job.progress}%
        </div>
        <div style={{
          height: 8,
          borderRadius: 4,
          background: "#e5e5e5",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${job.progress}%`,
            background: "#2563eb",
            borderRadius: 4,
            transition: "width 0.3s ease",
          }} />
        </div>
      </div>
    );
  }

  if (isComplete) {
    const output = job.output as IngestOutput;
    return (
      <div style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        borderRadius: 8,
      }}>
        <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#166534" }}>
          Recipe extracted successfully
        </div>
        <div style={{ marginBottom: "1rem", color: "#444" }}>
          {output.recipe.title}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link
            to={`/recipes/${output.slug}`}
            style={{
              display: "inline-block",
              padding: "0.5rem 1.25rem",
              background: "#2563eb",
              color: "white",
              borderRadius: 6,
              textDecoration: "none",
              fontSize: "0.9rem",
            }}
          >
            View Recipe
          </Link>
          <button
            onClick={onReset}
            style={{
              padding: "0.5rem 1.25rem",
              background: "none",
              border: "1px solid #e5e5e5",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.9rem",
              color: "#444",
            }}
          >
            Add Another
          </button>
        </div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        background: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: 8,
      }}>
        <div style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#991b1b" }}>
          Extraction failed
        </div>
        <div style={{ marginBottom: "1rem", color: "#444", fontSize: "0.9rem" }}>
          {job.error}
        </div>
        <button
          onClick={onReset}
          style={{
            padding: "0.5rem 1.25rem",
            background: "none",
            border: "1px solid #e5e5e5",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "0.9rem",
            color: "#444",
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return null;
}
