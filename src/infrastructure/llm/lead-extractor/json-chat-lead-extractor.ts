import {
  type LeadExtractionResult,
  LeadExtractionResultSchema,
  type LeadExtractorInput,
  type LeadExtractorPort,
} from "@/application/voice/lead-extraction-result";
import { buildLeadExtractorUserPrompt, LEAD_EXTRACTOR_SYSTEM_PROMPT } from "./lead-extractor-prompt";

interface JsonChatLeadExtractorConfig {
  apiKey: string;
  model: string;
  endpoint: string;
  name: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  const match = trimmed.match(/\{[\s\S]*\}/u);
  if (!match) {
    throw new Error("Lead extractor response did not contain a JSON object.");
  }
  return JSON.parse(match[0]);
}

export class JsonChatLeadExtractor implements LeadExtractorPort {
  name: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;

  constructor(config: JsonChatLeadExtractorConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.endpoint = config.endpoint;
  }

  async extract(input: LeadExtractorInput): Promise<LeadExtractionResult> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: LEAD_EXTRACTOR_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: buildLeadExtractorUserPrompt(input),
          },
        ],
        response_format: {
          type: "json_object",
        },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Lead extractor ${this.name} failed with HTTP ${response.status}.`);
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`Lead extractor ${this.name} returned an empty response.`);
    }

    return LeadExtractionResultSchema.parse(parseJsonObject(content));
  }
}
