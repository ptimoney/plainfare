import { describe, it, expect, vi } from "vitest";
import { vttToPlainText } from "../src/server/services/subtitles.js";
import type { VideoMetadata } from "../src/server/services/subtitles.js";

describe("vttToPlainText", () => {
  it("extracts text from a basic VTT file", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
Hello and welcome to my kitchen.

00:00:03.000 --> 00:00:06.000
Today we're making pasta carbonara.

00:00:06.000 --> 00:00:09.000
You'll need eggs, guanciale, and pecorino.`;

    const result = vttToPlainText(vtt);
    expect(result).toContain("Hello and welcome to my kitchen.");
    expect(result).toContain("Today we're making pasta carbonara.");
    expect(result).toContain("You'll need eggs, guanciale, and pecorino.");
  });

  it("strips VTT tags", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
<c>Hello</c> and <00:00:01.500>welcome

00:00:03.000 --> 00:00:06.000
<c.colorCCCCCC>Today we cook</c>`;

    const result = vttToPlainText(vtt);
    expect(result).toContain("Hello and welcome");
    expect(result).toContain("Today we cook");
    expect(result).not.toContain("<c>");
  });

  it("deduplicates consecutive identical lines", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
First add the flour

00:00:02.000 --> 00:00:04.000
First add the flour

00:00:04.000 --> 00:00:06.000
Then add the sugar`;

    const result = vttToPlainText(vtt);
    const lines = result.split("\n").filter((l) => l.includes("First add the flour"));
    expect(lines).toHaveLength(1);
    expect(result).toContain("Then add the sugar");
  });

  it("skips metadata lines", () => {
    const vtt = `WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:03.000
Hello`;

    const result = vttToPlainText(vtt);
    expect(result).not.toContain("Kind:");
    expect(result).not.toContain("Language:");
    expect(result).toBe("Hello");
  });

  it("skips numeric cue identifiers", () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:03.000
Line one

2
00:00:03.000 --> 00:00:06.000
Line two`;

    const result = vttToPlainText(vtt);
    expect(result).toBe("Line one\nLine two");
  });

  it("handles empty VTT", () => {
    const result = vttToPlainText("WEBVTT\n\n");
    expect(result).toBe("");
  });
});

describe("VideoMetadata type", () => {
  it("has the expected shape", () => {
    const meta: VideoMetadata = {
      title: "Best Pasta Carbonara Recipe",
      description: "Ingredients:\n- 200g spaghetti\n- 4 egg yolks",
      thumbnail: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
    };
    expect(meta.title).toBe("Best Pasta Carbonara Recipe");
    expect(meta.description).toContain("200g spaghetti");
    expect(meta.thumbnail).toBeDefined();
  });

  it("allows undefined thumbnail", () => {
    const meta: VideoMetadata = {
      title: "Quick Recipe",
      description: "Some description",
    };
    expect(meta.thumbnail).toBeUndefined();
  });
});
