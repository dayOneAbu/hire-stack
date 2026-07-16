import OpenAI from "openai";
import { z } from "zod";

// NVIDIA NIM free tier (DeepSeek-V3 / GLM), OpenAI-compatible API (PRD §8).
// Swapping to OpenAI proper later is a base-URL + model-name change only —
// see FRS §3 for why extraction quality must be validated against real
// resumes before relying on this for production.
export const aiClient = new OpenAI({
  baseURL: process.env.AI_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.AI_API_KEY,
});

export const AI_MODEL = process.env.AI_MODEL ?? "deepseek-ai/deepseek-v3";

// Mirrors EmploymentPeriod / CandidateSoftware / CandidateSkill shapes directly —
// extraction and DB schema share one contract (FRS §3).
const extractionResultSchema = z.object({
  confidence: z.number().min(0).max(1),
  periods: z.array(
    z.object({
      companyName: z.string(),
      jobTitle: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      description: z.string().nullable(),
      documentedHourlyRate: z.number().nullable(),
    }),
  ),
  software: z.array(z.string()),
  skills: z.array(z.string()),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

const EXTRACTION_SYSTEM_PROMPT = `You extract structured employment data from resumes.
Return JSON only, matching this shape:
{
  "confidence": number (0-1, your confidence this is a real, readable resume),
  "periods": [{ "companyName": string, "jobTitle": string|null, "startDate": "YYYY-MM-DD"|null, "endDate": "YYYY-MM-DD"|null, "description": string|null, "documentedHourlyRate": number|null }],
  "software": [string],
  "skills": [string]
}
If the text is not a resume or is unreadable, return confidence near 0 and empty arrays.`;

export async function extractResumeData(text: string): Promise<ExtractionResult> {
  const completion = await aiClient.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return extractionResultSchema.parse(JSON.parse(raw));
}
