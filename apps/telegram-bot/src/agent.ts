import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

interface AgentInput {
  text?: string;
  imageBuffer?: ArrayBuffer;
}

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
    model: anthropic("claude-3-5-sonnet-20241022"),
    messages: [{ role: "user", content }],
  });

  return result;
}
