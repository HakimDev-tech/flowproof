export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
}

export function getGeminiConfig(): GeminiConfig {
  const apiKey = process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_MODEL;

  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY environment variable.");
  }

  if (!model) {
    throw new Error("Missing GEMINI_MODEL environment variable.");
  }

  return {
    apiKey,
    model,
    temperature: 0,
  };
}