/**
 * The agent loop: one model, a set of tools, run until the model stops asking
 * for tools. Used by the daily assistant and by in-app delegated task threads.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { AiProviderConfig } from "@/lib/ai";

export type AgentEvent =
  | { type: "start" }
  | { type: "text"; text: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: string; isError?: boolean }
  | { type: "done" }
  | { type: "error"; message: string };

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(args: unknown): Promise<unknown>;
}

export interface AgentRun {
  /** All text the model wrote this turn, in order. */
  text: string;
  toolCalls: { name: string; input: Record<string, unknown>; isError: boolean }[];
}

const MAX_ITERATIONS = 12;
const MAX_RESULT_CHARS = 20000;

export function assertAgentCapable(config: AiProviderConfig) {
  if (config.provider !== "anthropic") {
    throw new Error("The assistant and agent threads need an Anthropic API key (OpenRouter is not supported yet).");
  }
}

export async function runAgentLoop(opts: {
  config: AiProviderConfig;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: AgentTool[];
  onEvent: (event: AgentEvent) => void;
}): Promise<AgentRun> {
  assertAgentCapable(opts.config);
  const client = new Anthropic({ apiKey: opts.config.apiKey });
  const messages = [...opts.messages];
  const toolsByName = new Map(opts.tools.map((t) => [t.name, t]));
  const tools: Anthropic.Tool[] = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const run: AgentRun = { text: "", toolCalls: [] };

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const response = await client.messages.create({
      model: opts.config.model,
      max_tokens: 16000,
      system: opts.system,
      tools,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        opts.onEvent({ type: "text", text: block.text });
        run.text += (run.text ? "\n\n" : "") + block.text.trim();
      }
    }

    const stop = response.stop_reason as string | null;
    if (stop === "refusal") {
      const note = "The model declined to continue with this request.";
      opts.onEvent({ type: "text", text: note });
      run.text += (run.text ? "\n\n" : "") + note;
      break;
    }
    if (stop === "max_tokens") {
      throw new Error("The model's reply was cut off before it finished. Try a narrower request.");
    }

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (toolUses.length === 0) {
      if (stop === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      break;
    }

    // Pass the assistant turn back untouched (thinking blocks included).
    messages.push({ role: "assistant", content: response.content });

    const results = await Promise.all(
      toolUses.map(async (block): Promise<Anthropic.ToolResultBlockParam> => {
        const input = (block.input ?? {}) as Record<string, unknown>;
        opts.onEvent({ type: "tool_call", name: block.name, input });
        let result: string;
        let isError = false;
        try {
          const tool = toolsByName.get(block.name);
          if (!tool) throw new Error(`Unknown tool: ${block.name}`);
          const value = await tool.run(input);
          result = typeof value === "string" ? value : JSON.stringify(value);
        } catch (err) {
          isError = true;
          result = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
        if (result.length > MAX_RESULT_CHARS) {
          result = `${result.slice(0, MAX_RESULT_CHARS)}\n…[result truncated at ${MAX_RESULT_CHARS} characters; narrow the query to see the rest]`;
        }
        run.toolCalls.push({ name: block.name, input, isError });
        opts.onEvent({ type: "tool_result", name: block.name, result: result.slice(0, 300), isError });
        return { type: "tool_result", tool_use_id: block.id, content: result, is_error: isError };
      })
    );

    // All results for one assistant turn go back in a single user message.
    messages.push({ role: "user", content: results });
  }

  return run;
}
