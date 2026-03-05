import { GoogleGenAI } from "@google/genai";

interface AgentInput {
  text?: string;
  imageBuffer?: ArrayBuffer;
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

export async function runAgent({
  text,
  imageBuffer,
}: AgentInput): Promise<string> {
  const contents: object[] = [];

  if (imageBuffer) {
    const base64 = Buffer.from(imageBuffer).toString("base64");
    contents.push({ inlineData: { mimeType: "image/jpeg", data: base64 } });
  }

  contents.push({ text: text || (imageBuffer ? "Describe what you see in this image." : "") });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents,
  });

  return response.text ?? "";
}
