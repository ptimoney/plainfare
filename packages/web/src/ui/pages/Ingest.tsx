import { useState } from "react";
import { Link } from "react-router-dom";
import { Tabs } from "../components/Tabs.js";
import { Alert } from "../components/Alert.js";
import { JobProgress } from "../components/JobProgress.js";
import { UrlIngestForm } from "../components/UrlIngestForm.js";
import { TextIngestForm } from "../components/TextIngestForm.js";
import { ImageIngestForm } from "../components/ImageIngestForm.js";
import { useHealthCheck } from "../hooks/useHealthCheck.js";
import styles from "./Ingest.module.css";

type Tab = "url" | "text" | "image";

const tabs = [
  { key: "url", label: "From URL" },
  { key: "text", label: "From Text" },
  { key: "image", label: "From Image" },
];

function AiNotConfigured() {
  return (
    <Alert variant="warning">
      AI provider is not configured. This feature requires an AI endpoint.
      Set the <code>PLAINFARE_AI_ENDPOINT</code> environment variable to enable it.
    </Alert>
  );
}

export function Ingest() {
  const [activeTab, setActiveTab] = useState<Tab>("url");
  const [jobId, setJobId] = useState<string | null>(null);
  const { aiAvailable } = useHealthCheck();

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
        </>
      )}
    </div>
  );
}
