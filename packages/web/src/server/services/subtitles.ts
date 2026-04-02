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
 * Extract the thumbnail URL from a video using yt-dlp.
 * Returns undefined if no thumbnail is available.
 */
export async function extractThumbnail(url: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(
      "yt-dlp",
      ["--skip-download", "--print", "thumbnail", url],
      { timeout: 15_000 },
      (err, stdout) => {
        if (err) return resolve(undefined);
        const thumb = stdout.trim();
        resolve(thumb || undefined);
      },
    );
  });
}

/**
 * Extract subtitles from a video URL using yt-dlp.
 * Returns the subtitle text, or undefined if no subtitles are available.
 */
export async function extractSubtitles(url: string): Promise<string | undefined> {
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
          "--sub-lang", "en.*,en",
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
      return undefined;
    }

    const vttContent = await readFile(files[0], "utf-8");
    return vttToPlainText(vttContent);
  } catch {
    return undefined;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export interface VideoMetadata {
  title: string;
  description: string;
  thumbnail?: string;
}

/**
 * Extract video metadata (title, description, thumbnail) using yt-dlp --dump-json.
 * Works across YouTube, TikTok, Instagram, and other supported platforms.
 */
export async function extractVideoMetadata(url: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      ["--skip-download", "--dump-json", url],
      { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(new Error(`Failed to extract video metadata: ${err.message}`));
        try {
          const data = JSON.parse(stdout);
          resolve({
            title: data.title ?? data.fulltitle ?? "",
            description: data.description ?? "",
            thumbnail: data.thumbnail || undefined,
          });
        } catch {
          reject(new Error("Failed to parse video metadata"));
        }
      },
    );
  });
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
