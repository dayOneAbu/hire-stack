import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

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
