import { Link } from "react-router-dom";
import { useJobPolling } from "../hooks/useJobPolling.js";
import { Button } from "./Button.js";
import { Alert } from "./Alert.js";
import { ProgressBar } from "./ProgressBar.js";
import styles from "./JobProgress.module.css";

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

  if (!jobId) return null;

  if (!job) {
    return (
      <div className={styles.wrapper}>
        <ProgressBar progress={0} label="Starting..." />
      </div>
    );
  }

  if (isPolling) {
    const label = job.status === "pending" ? `Queued... ${job.progress}%` : `Extracting recipe... ${job.progress}%`;
    return (
      <div className={styles.wrapper}>
        <ProgressBar progress={job.progress} label={label} />
      </div>
    );
  }

  if (isComplete) {
    const output = job.output as IngestOutput;
    return (
      <div className={styles.wrapper}>
        <Alert
          variant="success"
          title="Recipe extracted successfully"
          actions={
            <>
              <Link to={`/recipes/${output.slug}`} className={styles.viewLink}>
                <Button>View Recipe</Button>
              </Link>
              <Button variant="secondary" onClick={onReset}>
                Add Another
              </Button>
            </>
          }
        >
          {output.recipe.title}
        </Alert>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className={styles.wrapper}>
        <Alert
          variant="error"
          title="Extraction failed"
          actions={
            <Button variant="secondary" onClick={onReset}>
              Try Again
            </Button>
          }
        >
          {job.error}
        </Alert>
      </div>
    );
  }

  return null;
}
