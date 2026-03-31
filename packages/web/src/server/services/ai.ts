import type { AiProvider } from "@mise/core";
import { buildImageExtractionPrompt } from "@mise/core";
import type { Config } from "../config.js";

/**
 * OpenAI-compatible AI provider. Works with any API that implements
 * the OpenAI chat completions endpoint (OpenAI, Anthropic via proxy,
 * Ollama, LMStudio, etc.)
 */
export class OpenAiCompatibleProvider implements AiProvider {
  private endpoint: string;
  private apiKey: string;
  private model: string;

  constructor(config: Pick<Config, "MISE_AI_ENDPOINT" | "MISE_AI_API_KEY" | "MISE_AI_MODEL">) {
    if (!config.MISE_AI_ENDPOINT) {
      throw new Error("MISE_AI_ENDPOINT is required for AI ingestion");
    }
    this.endpoint = config.MISE_AI_ENDPOINT;
    this.apiKey = config.MISE_AI_API_KEY || "";
    this.model = config.MISE_AI_MODEL;
  }

  async extractRecipeFromImage(image: Uint8Array, mimeType: string): Promise<string> {
    const base64 = Buffer.from(image).toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: buildImageExtractionPrompt(),
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
              {
                type: "text",
                text: "Extract the recipe from this image.",
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI provider error ${response.status}: ${body}`);
    }

    const data = await response.json() as {
      choices: { message: { content: string } }[];
    };

    return data.choices[0].message.content;
  }
}
