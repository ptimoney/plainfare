import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { Button } from "./Button.js";
import { Alert } from "./Alert.js";
import { ProgressBar } from "./ProgressBar.js";
import { useJobPolling } from "../hooks/useJobPolling.js";
import styles from "./IngestForm.module.css";
import batchStyles from "./BatchUrlIngestForm.module.css";

interface BatchJob {
  url: string;
  jobId: string | null;
  error?: string;
}

function BatchJobRow({ job }: { job: BatchJob }) {
  const { job: polledJob, isPolling, isComplete, isFailed } = useJobPolling(job.jobId);

  const host = (() => {
    try { return new URL(job.url).hostname; } catch { return job.url; }
  })();

  if (job.error) {
    return (
      <div className={batchStyles.row}>
        <span className={batchStyles.url} title={job.url}>{host}</span>
        <span className={batchStyles.statusError}>Failed to submit</span>
      </div>
    );
  }

  if (!job.jobId || !polledJob) {
    return (
      <div className={batchStyles.row}>
        <span className={batchStyles.url} title={job.url}>{host}</span>
        <span className={batchStyles.statusPending}>Queued</span>
      </div>
    );
  }

  if (isPolling) {
    return (
      <div className={batchStyles.row}>
        <span className={batchStyles.url} title={job.url}>{host}</span>
        <ProgressBar progress={polledJob.progress} />
      </div>
    );
  }

  if (isComplete) {
    const output = polledJob.output as { slug: string; recipe: { title: string } };
    return (
      <div className={batchStyles.row}>
        <Link to={`/recipes/${output.slug}`} className={batchStyles.url} title={job.url}>
          {output.recipe.title}
        </Link>
        <span className={batchStyles.statusDone}>Done</span>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className={batchStyles.row}>
        <span className={batchStyles.url} title={job.url}>{host}</span>
        <span className={batchStyles.statusError}>{polledJob.error ?? "Failed"}</span>
      </div>
    );
  }

  return null;
}

export function BatchUrlIngestForm() {
  const [urls, setUrls] = useState("");
  const [useBrowser, setUseBrowser] = useState(false);
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const mutation = trpc.ingest.fromUrl.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = urls
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (parsed.length === 0) return;

    setSubmitting(true);
    const batchJobs: BatchJob[] = parsed.map((url) => ({ url, jobId: null }));
    setJobs(batchJobs);

    for (let i = 0; i < batchJobs.length; i++) {
      try {
        const result = await mutation.mutateAsync({ url: batchJobs[i].url, useBrowser });
        batchJobs[i] = { ...batchJobs[i], jobId: result.jobId };
      } catch (err) {
        batchJobs[i] = { ...batchJobs[i], error: String(err) };
      }
      setJobs([...batchJobs]);
    }
    setSubmitting(false);
  }

  if (jobs.length > 0) {
    const completed = jobs.filter((j) => j.jobId || j.error).length;
    return (
      <div>
        <div className={batchStyles.summary}>
          {submitting
            ? `Submitting ${completed} of ${jobs.length}...`
            : `${jobs.length} recipes submitted`}
        </div>
        <div className={batchStyles.list}>
          {jobs.map((job, i) => (
            <BatchJobRow key={i} job={job} />
          ))}
        </div>
        {!submitting && (
          <div className={batchStyles.actions}>
            <Button variant="secondary" onClick={() => { setJobs([]); setUrls(""); }}>
              Start Over
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.field}>
        <textarea
          className={batchStyles.textarea}
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder={"Paste one URL per line\nhttps://example.com/recipe-1\nhttps://example.com/recipe-2"}
          rows={8}
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
      <Button type="submit" disabled={!urls.trim() || submitting}>
        {submitting ? "Submitting..." : "Import All"}
      </Button>
    </form>
  );
}
