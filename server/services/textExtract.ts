import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import path from "path";
import { pathToFileURL } from "url";

// pdfjs's Node fallback path still resolves workerSrc as a module import (not a real
// worker thread) — Turbopack's chunked dev output breaks its default relative path
// ("./pdf.worker.mjs"). Build the real on-disk path at runtime (not a static import
// specifier, so Turbopack doesn't try to bundle it) and point workerSrc there instead.
const workerPath = path.join(process.cwd(), "node_modules/pdf-parse/dist/worker/pdf.worker.mjs");
PDFParse.setWorker(pathToFileURL(workerPath).href);

export async function extractText(fileBuffer: Buffer, contentType: string): Promise<string> {
  if (contentType === "application/pdf") {
    const parser = new PDFParse({ data: fileBuffer });
    const result = await parser.getText();
    return result.text;
  }
  // .doc / .docx — mammoth handles both via its raw-text extractor
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return result.value;
}
