import type { AiProvider } from "@plainfare/core";
import { buildImageTranscriptionPrompt, buildTextExtractionPrompt, buildNutritionEstimationPrompt } from "@plainfare/core";
import type { Config } from "../config.js";

interface EndpointConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

/**
 * OpenAI-compatible AI provider. Works with any API that implements
 * the OpenAI chat completions endpoint (OpenAI, Anthropic via proxy,
 * Ollama, LMStudio, etc.)
 *
 * Supports separate endpoints for text and vision tasks. If vision-specific
 * config is not provided, it falls back to the default text endpoint.
 *
 * Image extraction uses a two-step pipeline: the vision model transcribes
 * the image to text, then the text model extracts structured recipe JSON.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  private text: EndpointConfig;
  private vision: EndpointConfig;

  constructor(
    config: Pick<
      Config,
      | "PLAINFARE_AI_ENDPOINT"
      | "PLAINFARE_AI_API_KEY"
      | "PLAINFARE_AI_MODEL"
      | "PLAINFARE_AI_VISION_ENDPOINT"
      | "PLAINFARE_AI_VISION_API_KEY"
      | "PLAINFARE_AI_VISION_MODEL"
    >,
  ) {
    if (!config.PLAINFARE_AI_ENDPOINT) {
      throw new Error("PLAINFARE_AI_ENDPOINT is required for AI ingestion");
    }

    this.text = {
      endpoint: config.PLAINFARE_AI_ENDPOINT,
      apiKey: config.PLAINFARE_AI_API_KEY ?? "",
      model: config.PLAINFARE_AI_MODEL,
    };

    this.vision = {
      endpoint: config.PLAINFARE_AI_VISION_ENDPOINT ?? config.PLAINFARE_AI_ENDPOINT,
      apiKey: config.PLAINFARE_AI_VISION_API_KEY ?? config.PLAINFARE_AI_API_KEY ?? "",
      model: config.PLAINFARE_AI_VISION_MODEL ?? config.PLAINFARE_AI_MODEL,
    };
  }

  private async callApi(
    cfg: EndpointConfig,
    systemPrompt: string,
    userContent: unknown,
    maxTokens: number,
    label: string,
  ): Promise<string> {
    const url = `${cfg.endpoint}/v1/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey && { Authorization: `Bearer ${cfg.apiKey}` }),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI provider error during ${label} (${cfg.model} @ ${url}): ${response.status}: ${body}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };

    return data.choices[0].message.content;
  }

  async extractRecipeFromImage(image: Uint8Array, mimeType: string): Promise<string> {
    const base64 = Buffer.from(image).toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Step 1: vision model reads the image and produces a plain-text transcription
    const transcription = await this.callApi(
      this.vision,
      buildImageTranscriptionPrompt(),
      [
        { type: "image_url", image_url: { url: dataUrl } },
        { type: "text", text: "Transcribe this recipe." },
      ],
      2048,
      "vision transcription",
    );

    // Step 2: text model converts the transcription to structured recipe JSON
    return this.callApi(this.text, buildTextExtractionPrompt(), transcription, 4096, "recipe extraction");
  }

  async extractRecipeFromText(text: string): Promise<string> {
    return this.callApi(this.text, buildTextExtractionPrompt(), text, 4096, "recipe extraction");
  }

  async estimateNutrition(ingredientText: string): Promise<string> {
    return this.callApi(this.text, buildNutritionEstimationPrompt(), ingredientText, 1024, "nutrition estimation");
  }
}
