import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AuthorizedContext } from "./access";
import { serverEnv } from "./env";
import { devLog } from "./http";

/**
 * AI provider boundary for the demo apps.
 *
 * Apps receive context only through the ContextPass gate (access.ts); this
 * module just turns that already-authorized context into a response. With
 * ANTHROPIC_API_KEY set it uses Claude; otherwise — or if the call fails —
 * a deterministic demo writer, labelled as such. The product works either way.
 */

export interface AppTask {
  appSlug: string;
  appName: string;
  task: string;
  context: AuthorizedContext["context"];
}

export interface AppResponse {
  text: string;
  provider: "claude" | "demo";
  model?: string;
  /** Shown quietly when the demo writer stood in for Claude. */
  note?: string;
}

const ROLES: Record<string, string> = {
  "code-pilot":
    "You are CodePilot, a coding assistant. Give concrete, project-aware coding guidance that follows the person's stated style, languages and tools.",
  "study-os":
    "You are StudyOS, a study assistant. Plan focused study sessions that follow how the person says they like to learn.",
};

function systemPrompt(task: AppTask): string {
  return [
    ROLES[task.appSlug] ?? `You are ${task.appName}, an AI assistant.`,
    "ContextPass gave you only the context the person authorized, shown in the user turn. Use it to personalise the answer, and say which parts you used.",
    "Do not assume anything about the person beyond that context. If it is thin, say what more would help.",
    "Plain text. Under 170 words. Short paragraphs or a short list.",
  ].join("\n");
}

function contextBlock(context: AppTask["context"]): string {
  return context
    .map((c) => `## ${c.label}\n${c.items.length ? c.items.map((i) => `- ${i.title}: ${i.content}`).join("\n") : "- (nothing stored)"}`)
    .join("\n\n");
}

async function withClaude(task: AppTask, apiKey: string): Promise<AppResponse | undefined> {
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  const model = serverEnv.aiModel();
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      // Server-side refusal fallback: on a policy decline, the API re-runs the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: systemPrompt(task),
      messages: [
        {
          role: "user",
          content: `Authorized context from ContextPass:\n\n${contextBlock(task.context)}\n\nRequest: ${task.task}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      devLog("ai.refusal", { category: response.stop_details?.category ?? null });
      return undefined;
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return text ? { text, provider: "claude", model: response.model } : undefined;
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) devLog("ai.auth_failed");
    else if (error instanceof Anthropic.RateLimitError) devLog("ai.rate_limited");
    else if (error instanceof Anthropic.APIError) devLog("ai.api_error", { status: error.status });
    else devLog("ai.unreachable");
    return undefined;
  }
}

/** Trims trailing punctuation so stored text can sit inside a sentence. */
const sentence = (text: string) => text.trim().replace(/[.:;\s]+$/, "");

/** Deterministic writer: personalises from the authorized context only. */
function demoWriter(task: AppTask): AppResponse {
  const items = (scope: string) => task.context.find((c) => c.scope === scope)?.items ?? [];
  const lines: string[] = [];

  if (task.appSlug === "code-pilot") {
    const projects = items("projects");
    const prefs = items("coding-preferences");
    lines.push(projects.length ? `Working on: ${sentence(projects[0].content)}.` : "No projects are stored yet, so this stays general.");
    if (prefs.length) lines.push(`Your preferences: ${prefs.map((p) => sentence(p.content)).join("; ")}.`);
    lines.push("Next steps:");
    lines.push(
      "1. Start with the smallest change that moves the project forward, and keep it in one focused function.",
      "2. Name the inputs and outputs before writing the body; add the types first.",
      "3. Avoid a new dependency unless it removes more code than it adds.",
    );
    if (projects.length > 1) lines.push(`Also on your list: ${projects.slice(1).map((p) => p.title).join(", ")}.`);
  } else if (task.appSlug === "study-os") {
    const prefs = items("study-preferences");
    lines.push(prefs.length ? `Planned around how you learn: ${prefs.map((p) => sentence(p.content)).join("; ")}.` : "No study preferences are stored yet, so this plan is generic.");
    lines.push(
      "1. 5 min — one worked example, read slowly.",
      "2. 20 min — two practice problems in the same shape; check each before moving on.",
      "3. 5 min — write the idea back in one sentence, then stop.",
    );
  } else {
    lines.push(`Using ${task.context.map((c) => c.label).join(" and ")} from ContextPass.`);
  }

  return { text: lines.join("\n"), provider: "demo", note: "Demo writer — no AI model was called." };
}

export async function generateResponse(task: AppTask): Promise<AppResponse> {
  const apiKey = serverEnv.anthropicApiKey();
  if (apiKey) {
    const answer = await withClaude(task, apiKey);
    if (answer) return answer;
    return { ...demoWriter(task), note: "Claude wasn’t available, so the demo writer answered instead." };
  }
  return demoWriter(task);
}
