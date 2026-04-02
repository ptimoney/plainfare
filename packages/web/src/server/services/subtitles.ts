import { execFile } from "node:child_process";
import { readFile, mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Check whether yt-dlp is installed and accessible.
 */
export async function isYtDlpAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("yt-dlp", ["--version"], (err) => {
      resolve(!err);
    });
  });
}

/**
 * Extract subtitles from a video URL using yt-dlp.
 * Returns the subtitle text, or throws if no subtitles are available.
 */
export async function extractSubtitles(url: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "plainfare-subs-"));

  try {
    const outputTemplate = join(tempDir, "subs");

    // Download auto-generated subtitles (or manual if available)
    await new Promise<void>((resolve, reject) => {
      execFile(
        "yt-dlp",
        [
          "--skip-download",
          "--write-auto-sub",
          "--write-sub",
          "--sub-lang", "en",
          "--sub-format", "vtt",
          "--output", outputTemplate,
          url,
        ],
        { timeout: 60_000 },
        (err, _stdout, stderr) => {
          if (err) reject(new Error(`yt-dlp failed: ${stderr || err.message}`));
          else resolve();
        },
      );
    });

    // Find the downloaded subtitle file
    const dirEntries = await readdir(tempDir);
    const files = dirEntries.filter((f) => f.endsWith(".vtt")).map((f) => join(tempDir, f));

    if (files.length === 0) {
      throw new Error("No subtitles available for this video. Try a video with captions enabled.");
    }

    const vttContent = await readFile(files[0], "utf-8");
    return vttToPlainText(vttContent);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Convert a WebVTT subtitle file to clean plain text.
 * Strips timestamps, metadata, tags, and deduplicates repeated lines.
 */
export function vttToPlainText(vtt: string): string {
  const lines = vtt.split("\n");
  const textLines: string[] = [];
  let lastLine = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip WEBVTT header, empty lines, NOTE blocks
    if (trimmed === "WEBVTT" || trimmed === "" || trimmed.startsWith("NOTE")) continue;
    // Skip Kind/Language metadata
    if (/^(Kind|Language):/.test(trimmed)) continue;
    // Skip timestamp lines (00:00:00.000 --> 00:00:03.000)
    if (/^\d{2}:\d{2}/.test(trimmed) && trimmed.includes("-->")) continue;
    // Skip numeric cue identifiers
    if (/^\d+$/.test(trimmed)) continue;

    // Strip VTT tags like <c>, </c>, <00:00:00.000>, etc.
    const cleaned = trimmed
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    if (!cleaned) continue;

    // Deduplicate consecutive identical lines (common in auto-generated subs)
    if (cleaned !== lastLine) {
      textLines.push(cleaned);
      lastLine = cleaned;
    }
  }

  return textLines.join("\n");
}
