import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { ProgressBar } from "../components/ProgressBar.js";
import styles from "./Jobs.module.css";

const TYPE_LABELS: Record<string, string> = {
  "ai-ingest": "Image extraction",
  "ai-text-ingest": "Text extraction",
  "url-ingest": "URL extraction",
  "browser-fetch": "Browser fetch",
  "import-ingest": "Import",
  "video-ingest": "Video extraction",
};

function formatTime(date: string | Date) {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface IngestOutput {
  slug: string;
  recipe: { title: string };
}

function JobCard({ job }: { job: { id: string; type: string; status: string; progress: number; output?: unknown; error?: string; createdAt: string | Date } }) {
  const label = TYPE_LABELS[job.type] ?? job.type;
  const statusClass = styles[`status${job.status.charAt(0).toUpperCase() + job.status.slice(1)}` as keyof typeof styles] ?? "";

  return (
    <div className={styles.job}>
      <div className={styles.jobHeader}>
        <div>
          <span className={styles.jobType}>{label}</span>
          {" "}
          <span className={`${styles.jobStatus} ${statusClass}`}>{job.status}</span>
        </div>
        <span className={styles.jobTime}>{formatTime(job.createdAt)}</span>
      </div>

      {(job.status === "pending" || job.status === "running") && (
        <ProgressBar
          progress={job.progress}
          label={job.status === "pending" ? `Queued... ${job.progress}%` : `Extracting recipe... ${job.progress}%`}
        />
      )}

      {job.status === "completed" && !!job.output && (
        <div className={styles.jobResult}>
          <Link to={`/recipes/${(job.output as IngestOutput).slug}`}>
            {(job.output as IngestOutput).recipe.title}
          </Link>
        </div>
      )}

      {job.status === "failed" && job.error && (
        <div className={styles.jobError}>{String(job.error)}</div>
      )}
    </div>
  );
}

export function Jobs() {
  const { data: jobs } = trpc.jobs.list.useQuery(undefined, { refetchInterval: 2000 });

  return (
    <div>
      <Link to="/" className={styles.backLink}>&larr; All recipes</Link>
      <h1 className={styles.title}>Jobs</h1>

      {jobs && jobs.length === 0 && (
        <p className={styles.empty}>No jobs yet. Start one from <Link to="/ingest">Add Recipe</Link>.</p>
      )}

      {jobs && jobs.length > 0 && (
        <div className={styles.list}>
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
