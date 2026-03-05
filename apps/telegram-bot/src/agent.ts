import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

interface AgentInput {
  text?: string;
  imageBuffer?: ArrayBuffer;
}

const gemini = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

export async function runAgent({
  text,
  imageBuffer,
}: AgentInput): Promise<string> {
  const content = [
    ...(imageBuffer ? [{ type: "image" as const, image: imageBuffer }] : []),
    {
      type: "text" as const,
      text: text || (imageBuffer ? "Describe what you see in this image." : ""),
    },
  ];

  const { text: result } = await generateText({
    model: gemini("gemini-3-flash-preview"),
    messages: [{ role: "user", content }],
  });

  return result;
}
