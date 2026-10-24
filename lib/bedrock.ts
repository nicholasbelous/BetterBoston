// Amazon Bedrock Runtime client (Claude). Server-side only.
// Credentials come from the standard AWS chain (env vars or AWS_PROFILE).
import "server-only";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { config } from "@/lib/config";

let client: BedrockRuntimeClient | null = null;

export function getBedrockClient(): BedrockRuntimeClient {
  client ??= new BedrockRuntimeClient({ region: config.awsRegion });
  return client;
}

/**
 * TODO (task 4.3): call ConverseCommand with
 * - modelId: config.bedrockModelId (throw if missing)
 * - system: [{ text: system }]
 * - messages: [{ role: "user", content: [{ text: user }] }]
 * - toolConfig with ONE tool ("submit_action_plan") whose inputSchema.json is
 *   `toolInputJsonSchema`, and toolChoice: { tool: { name: "submit_action_plan" } }
 *   so the model must answer with structured JSON.
 * - inferenceConfig: { maxTokens: 1200, temperature: 0.2 }
 * Return the toolUse.input object from the response (unvalidated; the caller validates).
 */
export async function converseForJson(args: {
  system: string;
  user: string;
  toolInputJsonSchema: Record<string, unknown>;
}): Promise<unknown> {
  void args;
  void getBedrockClient;
  throw new Error("converseForJson not implemented yet (task 4.3)");
}
