import OpenAI from "openai";

// NVIDIA NIM free tier (DeepSeek-V3 / GLM), OpenAI-compatible API (PRD §8).
// Swapping to OpenAI proper later is a base-URL + model-name change only —
// see FRS §3 for why extraction quality must be validated against real
// resumes before relying on this for production.
export const aiClient = new OpenAI({
  baseURL: process.env.AI_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.AI_API_KEY,
});

export const AI_MODEL = process.env.AI_MODEL ?? "deepseek-ai/deepseek-v3";
