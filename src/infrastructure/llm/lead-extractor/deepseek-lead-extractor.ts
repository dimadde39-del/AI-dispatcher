import { JsonChatLeadExtractor } from "./json-chat-lead-extractor";

interface DeepSeekLeadExtractorConfig {
  apiKey: string;
  model: string;
}

export class DeepSeekLeadExtractor extends JsonChatLeadExtractor {
  constructor(config: DeepSeekLeadExtractorConfig) {
    super({
      name: "deepseek",
      apiKey: config.apiKey,
      model: config.model,
      endpoint: "https://api.deepseek.com/chat/completions",
    });
  }
}
