import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../lib/trpc.js";
import { JobProgress } from "../components/JobProgress.js";
import { useHealthCheck } from "../hooks/useHealthCheck.js";

type Tab = "url" | "text" | "image";

const tabStyle = (active: boolean) => ({
  background: "none",
  border: "none",
  borderBottom: `2px solid ${active ? "#2563eb" : "transparent"}`,
  color: active ? "#2563eb" : "#666",
  padding: "0.75rem 1.25rem",
  cursor: "pointer" as const,
  fontSize: "0.95rem",
  fontWeight: active ? 600 : 400,
});

const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid #e5e5e5",
  borderRadius: 6,
  fontSize: "0.95rem",
  fontFamily: "inherit",
};

const buttonStyle = {
  padding: "0.5rem 1.25rem",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer" as const,
  fontSize: "0.9rem",
};

const disabledButtonStyle = {
  ...buttonStyle,
  background: "#93c5fd",
  cursor: "not-allowed" as const,
};

function AiNotConfigured() {
  return (
    <div style={{
      background: "#fff3cd",
      border: "1px solid #ffc107",
      borderRadius: 6,
      padding: "1rem",
      fontSize: "0.9rem",
      color: "#664d03",
    }}>
      AI provider is not configured. This feature requires an AI endpoint.
      Set the <code>MISE_AI_ENDPOINT</code> environment variable to enable it.
    </div>
  );
}

export function Ingest() {
  const [activeTab, setActiveTab] = useState<Tab>("url");
  const [jobId, setJobId] = useState<string | null>(null);

  // URL state
  const [url, setUrl] = useState("");
  const [useBrowser, setUseBrowser] = useState(false);

  // Text state
  const [text, setText] = useState("");

  // Image state
  const [imageFile, setImageFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { aiAvailable } = useHealthCheck();

  // Mutations
  const fromUrl = trpc.ingest.fromUrl.useMutation({
    onSuccess: (data) => setJobId(data.jobId),
  });
  const fromText = trpc.ingest.fromText.useMutation({
    onSuccess: (data) => setJobId(data.jobId),
  });
  const fromImage = trpc.ingest.fromImage.useMutation({
    onSuccess: (data) => setJobId(data.jobId),
  });

  const isSubmitting = fromUrl.isPending || fromText.isPending || fromImage.isPending;

  function handleReset() {
    setJobId(null);
    setUrl("");
    setText("");
    setImageFile(null);
    fromUrl.reset();
    fromText.reset();
    fromImage.reset();
  }

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    fromUrl.mutate({ url: url.trim(), useBrowser });
  }

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    fromText.mutate({ text: text.trim() });
  }

  function handleImageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile) return;
    fromImage.mutate({
      image: imageFile.data,
      mimeType: imageFile.mimeType,
      filename: imageFile.name,
    });
  }

  function processFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip data:image/jpeg;base64, prefix
      const commaIdx = dataUrl.indexOf(",");
      const mimeType = dataUrl.slice(5, dataUrl.indexOf(";"));
      const data = dataUrl.slice(commaIdx + 1);
      setImageFile({ data, mimeType, name: file.name });
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
    <div>
      <Link to="/" style={{ fontSize: "0.85rem", color: "#2563eb" }}>
        &larr; All recipes
      </Link>

      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: "1rem 0" }}>
        Add Recipe
      </h1>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #e5e5e5", marginBottom: "1.5rem" }}>
        <button style={tabStyle(activeTab === "url")} onClick={() => setActiveTab("url")}>
          From URL
        </button>
        <button style={tabStyle(activeTab === "text")} onClick={() => setActiveTab("text")}>
          From Text
        </button>
        <button style={tabStyle(activeTab === "image")} onClick={() => setActiveTab("image")}>
          From Image
        </button>
      </div>

      {/* Job progress (replaces form when active) */}
      {jobId ? (
        <JobProgress jobId={jobId} onReset={handleReset} />
      ) : (
        <>
          {/* URL tab */}
          {activeTab === "url" && (
            <form onSubmit={handleUrlSubmit}>
              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/recipe"
                  style={inputStyle}
                  required
                />
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.85rem", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={useBrowser}
                    onChange={(e) => setUseBrowser(e.target.checked)}
                  />
                  Use browser rendering (for JavaScript-heavy sites)
                </label>
              </div>
              <button
                type="submit"
                disabled={!url.trim() || isSubmitting}
                style={!url.trim() || isSubmitting ? disabledButtonStyle : buttonStyle}
              >
                {isSubmitting ? "Submitting..." : "Import Recipe"}
              </button>
              {fromUrl.error && (
                <div style={{ marginTop: "0.75rem", color: "#991b1b", fontSize: "0.85rem" }}>
                  {fromUrl.error.message}
                </div>
              )}
            </form>
          )}

          {/* Text tab */}
          {activeTab === "text" && (
            <>
              {aiAvailable === false ? (
                <AiNotConfigured />
              ) : (
                <form onSubmit={handleTextSubmit}>
                  <div style={{ marginBottom: "1rem" }}>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Paste recipe text here..."
                      rows={10}
                      style={{ ...inputStyle, resize: "vertical" as const }}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!text.trim() || isSubmitting}
                    style={!text.trim() || isSubmitting ? disabledButtonStyle : buttonStyle}
                  >
                    {isSubmitting ? "Submitting..." : "Extract Recipe"}
                  </button>
                  {fromText.error && (
                    <div style={{ marginTop: "0.75rem", color: "#991b1b", fontSize: "0.85rem" }}>
                      {fromText.error.message}
                    </div>
                  )}
                </form>
              )}
            </>
          )}

          {/* Image tab */}
          {activeTab === "image" && (
            <>
              {aiAvailable === false ? (
                <AiNotConfigured />
              ) : (
                <form onSubmit={handleImageSubmit}>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${dragOver ? "#2563eb" : "#ccc"}`,
                      borderRadius: 8,
                      padding: "2rem",
                      textAlign: "center" as const,
                      cursor: "pointer",
                      marginBottom: "1rem",
                      background: dragOver ? "#eff6ff" : "transparent",
                      transition: "border-color 0.2s, background 0.2s",
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{ display: "none" }}
                    />
                    {imageFile ? (
                      <div style={{ color: "#444" }}>
                        <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{imageFile.name}</div>
                        <div style={{ fontSize: "0.85rem", color: "#666" }}>Click or drag to replace</div>
                      </div>
                    ) : (
                      <div style={{ color: "#888" }}>
                        Drag and drop an image, or click to select
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!imageFile || isSubmitting}
                    style={!imageFile || isSubmitting ? disabledButtonStyle : buttonStyle}
                  >
                    {isSubmitting ? "Submitting..." : "Extract Recipe"}
                  </button>
                  {fromImage.error && (
                    <div style={{ marginTop: "0.75rem", color: "#991b1b", fontSize: "0.85rem" }}>
                      {fromImage.error.message}
                    </div>
                  )}
                </form>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
