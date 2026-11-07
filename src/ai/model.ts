import { ChatGoogle } from "@langchain/google/node";
import { getGeminiConfig } from "./config.js";

export function createGeminiModel() {
  const config = getGeminiConfig();

  return new ChatGoogle({
    model: config.model,
    apiKey: config.apiKey,
    temperature: config.temperature,
    maxRetries: 2,
  });
}