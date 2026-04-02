import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs } from "../components/Tabs.js";
import { Alert } from "../components/Alert.js";
import { JobProgress } from "../components/JobProgress.js";
import { UrlIngestForm } from "../components/UrlIngestForm.js";
import { BatchUrlIngestForm } from "../components/BatchUrlIngestForm.js";
import { TextIngestForm } from "../components/TextIngestForm.js";
import { ImageIngestForm } from "../components/ImageIngestForm.js";
import { ImportIngestForm } from "../components/ImportIngestForm.js";
import { VideoIngestForm } from "../components/VideoIngestForm.js";
import { useHealthCheck } from "../hooks/useHealthCheck.js";
import styles from "./Ingest.module.css";

type Tab = "url" | "batch" | "text" | "image" | "import" | "video";

const allTabs = [
  { key: "url", label: "From URL" },
  { key: "batch", label: "Batch URLs" },
  { key: "text", label: "From Text" },
  { key: "image", label: "From Image" },
  { key: "import", label: "Import" },
  { key: "video", label: "From Video" },
];

function AiNotConfigured() {
  return (
    <Alert variant="warning">
      AI provider is not configured. This feature requires an AI endpoint.
      Set the <code>PLAINFARE_AI_ENDPOINT</code> environment variable to enable it.
    </Alert>
  );
}

function VideoNotAvailable({ aiAvailable, ytdlpAvailable }: { aiAvailable: boolean | null; ytdlpAvailable: boolean | null }) {
  const missing: string[] = [];
  if (!aiAvailable) missing.push("AI provider (PLAINFARE_AI_ENDPOINT)");
  if (!ytdlpAvailable) missing.push("yt-dlp");
  return (
    <Alert variant="warning">
      Video ingestion requires {missing.join(" and ")} to be available.
      {!ytdlpAvailable && <> Install <code>yt-dlp</code> on the host or use the Docker image which includes it.</>}
    </Alert>
  );
}

export function Ingest() {
  const [activeTab, setActiveTab] = useState<Tab>("url");
  const [jobId, setJobId] = useState<string | null>(null);
  const { aiAvailable, ytdlpAvailable } = useHealthCheck();

  const tabs = allTabs;

  function handleReset() {
    setJobId(null);
  }

  return (
    <div>
      <Link to="/" className={styles.backLink}>&larr; All recipes</Link>
      <h1 className={styles.title}>Add Recipe</h1>

      <Tabs tabs={tabs} active={activeTab} onChange={(key) => setActiveTab(key as Tab)} />

      {jobId ? (
        <JobProgress jobId={jobId} onReset={handleReset} />
      ) : (
        <>
          {activeTab === "url" && (
            <UrlIngestForm onJobCreated={setJobId} />
          )}

          {activeTab === "batch" && (
            <BatchUrlIngestForm />
          )}

          {activeTab === "text" && (
            aiAvailable === false
              ? <AiNotConfigured />
              : <TextIngestForm onJobCreated={setJobId} />
          )}

          {activeTab === "image" && (
            aiAvailable === false
              ? <AiNotConfigured />
              : <ImageIngestForm onJobCreated={setJobId} />
          )}

          {activeTab === "import" && (
            <ImportIngestForm onJobCreated={setJobId} />
          )}

          {activeTab === "video" && (
            aiAvailable === false || ytdlpAvailable === false
              ? <VideoNotAvailable aiAvailable={aiAvailable} ytdlpAvailable={ytdlpAvailable} />
              : <VideoIngestForm onJobCreated={setJobId} />
          )}
        </>
      )}
    </div>
  );
}
