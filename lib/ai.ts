import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { decrypt } from "@/lib/crypto";
import type { Task, User } from "@prisma/client";

export interface AiProviderConfig {
  provider: string;
  apiKey: string;
  model: string;
}

/**
 * Resolves the AI provider config from a user record.
 * Decrypts the stored API key.
 */
export function resolveAiConfig(
  user: Pick<User, "aiProvider" | "aiApiKey" | "aiModel" | "aiSchedulingModel">,
  useSchedulingModel = false
): AiProviderConfig {
  if (!user.aiProvider || !user.aiApiKey || !user.aiModel) {
    throw new Error("AI provider not configured. Please add your API key in Settings.");
  }

  const apiKey = decrypt(user.aiApiKey);
  const model = useSchedulingModel && user.aiSchedulingModel
    ? user.aiSchedulingModel
    : user.aiModel;

  return { provider: user.aiProvider, apiKey, model };
}

/**
 * Calls the configured AI provider with a prompt and returns the text response.
 */
export async function callAi(config: AiProviderConfig, prompt: string): Promise<string> {
  if (config.provider === "anthropic") {
    const client = new Anthropic({ apiKey: config.apiKey });
    const message = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    if (block.type !== "text") throw new Error("Unexpected response type from Anthropic");
    return block.text;
  }

  if (config.provider === "openrouter") {
    const client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
        "X-Title": "Task Manager",
      },
    });
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
    });
    return completion.choices[0]?.message?.content ?? "";
  }

  throw new Error(`Unknown AI provider: ${config.provider}`);
}

/**
 * Builds the AI scheduling prompt from tasks and time constraints.
 */
export function buildSchedulePrompt(
  tasks: Pick<Task, "id" | "title" | "description" | "priority" | "duration">[],
  date: string,
  workStartTime: string,
  workEndTime: string
): string {
  const taskList = tasks
    .map(
      (t, i) =>
        `${i + 1}. [${t.id}] "${t.title}" — priority: ${t.priority}, duration: ${t.duration ?? 30} min${t.description ? `, context: ${t.description}` : ""}`
    )
    .join("\n");

  return `You are a productivity assistant helping schedule tasks for ${date}.

Working hours: ${workStartTime} to ${workEndTime}

Tasks to schedule:
${taskList}

Rules:
- Schedule all tasks within working hours
- Higher priority tasks should be scheduled earlier
- Leave 10-minute breaks between tasks
- Duration defaults to 30 minutes if not specified
- Do not overlap tasks

Respond with ONLY a valid JSON array in this exact format, no explanation:
[
  { "taskId": "cuid_here", "startTime": "HH:MM", "duration": 30 },
  ...
]`;
}

/**
 * Builds a prompt for an AI agent to work on a task.
 */
export function buildAgentPromptRequest(
  task: Pick<Task, "title" | "description" | "notes" | "priority">
): string {
  return `You are a helpful AI assistant. Generate a clear, detailed prompt that a user can paste into an AI coding agent (like Claude Code) to work on the following task.

Task title: ${task.title}
Priority: ${task.priority}${task.description ? `\nDescription: ${task.description}` : ""}${task.notes ? `\nNotes: ${task.notes}` : ""}

The generated prompt should:
1. Clearly state the objective
2. Include all relevant context from the task details
3. Specify any constraints or requirements
4. Ask the agent to confirm their understanding before starting
5. Be ready to paste directly into an AI agent chat

Respond with ONLY the prompt text, nothing else.`;
}

/**
 * Validates that an AI config is working by making a minimal test call.
 */
export async function testAiConnection(config: AiProviderConfig): Promise<boolean> {
  try {
    const response = await callAi(config, "Reply with only the word: OK");
    return response.trim().includes("OK");
  } catch {
    return false;
  }
}
