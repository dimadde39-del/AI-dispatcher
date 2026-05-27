import { JsonChatLeadExtractor } from "./json-chat-lead-extractor";

interface OpenAiLeadExtractorConfig {
  apiKey: string;
  model: string;
}

export class OpenAiLeadExtractor extends JsonChatLeadExtractor {
  constructor(config: OpenAiLeadExtractorConfig) {
    super({
      name: "openai",
      apiKey: config.apiKey,
      model: config.model,
      endpoint: "https://api.openai.com/v1/chat/completions",
    });
  }
}
