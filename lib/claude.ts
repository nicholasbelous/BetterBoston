// Claude (Anthropic API) client. Server-side only.
// The API key comes from ANTHROPIC_API_KEY in .env.local. Never expose it to the browser.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { config } from "@/lib/config";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local and restart npm run dev.");
  }
  client ??= new Anthropic({ apiKey: config.anthropicApiKey, timeout: 30_000, maxRetries: 1 });
  return client;
}

/**
 * Asks Claude for structured JSON by forcing it to call a single tool whose
 * input schema is the shape we want. Returns the tool input UNVALIDATED;
 * the caller must validate it (see lib/actionPlanSchema.ts).
 */
export async function generateJson(args: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<unknown> {
  // zod's JSON Schema output includes a "$schema" key the API doesn't need.
  const schema = { ...args.inputSchema };
  delete schema.$schema;

  const message = await getClient().messages.create({
    model: config.claudeModel,
    max_tokens: args.maxTokens ?? 1200,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
    tools: [
      {
        name: args.toolName,
        description: args.toolDescription,
        input_schema: schema as Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: args.toolName },
  });

  const toolUse = message.content.find(
    (block): block is ToolUseBlock => block.type === "tool_use" && block.name === args.toolName,
  );
  if (!toolUse) {
    throw new Error(`Claude did not call ${args.toolName} (stop_reason: ${message.stop_reason})`);
  }
  return toolUse.input;
}
