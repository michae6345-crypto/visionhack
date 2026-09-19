/**
 * Two-pass vision pipeline, served through OpenRouter's chat completions API.
 *
 * Pass 1 "extract"  — transcribe printed lines verbatim.
 * Pass 2 "classify" — categorize, name the variety, size the pack, flag
 *                     perishability.
 *
 * Splitting them keeps transcription errors from being laundered into
 * confident-looking classifications. Both run at temperature 0 with reasoning
 * disabled: this is transcription and bookkeeping, not prose, and both passes
 * must fit inside the route's shared latency budget.
 *
 * HOW THE STRUCTURE IS ENFORCED. The model (Nemotron) accepts images and
 * supports tools, but NOT `response_format`, so asking for structured outputs
 * would be rejected before inference. Instead each pass declares exactly one
 * function generated from the Zod schema in ./schemas. Nemotron's sole live
 * provider currently rejects every explicit `tool_choice` value, so the
 * request omits that field. The answer is read from
 * `tool_calls[0].function.arguments` and validated with that same schema.
 *
 * `message.content` is IGNORED on purpose. A reasoning model emits prose next
 * to its tool call; treating that as data would be trusting the one part of
 * the response nothing constrains. The only accepted answer is a single,
 * correctly-named, schema-valid tool call — everything else fails closed as
 * `unparseable_model_output`.
 *
 * Plain `fetch` on purpose: OpenRouter speaks the OpenAI wire format, and a
 * vendor SDK would buy nothing for two request shapes.
 */
import * as z from "zod/v4";

import {
  API_KEY_ENV_VAR,
  CLASSIFY_TOOL_NAME,
  EXTRACT_TOOL_NAME,
  MAX_TOKENS,
  MISSING_KEY_MESSAGE,
  MODEL,
  MODEL_REQUEST_TIMEOUT_MS,
  MODEL_TEMPERATURE,
  OPENROUTER_API_URL,
  OUT_OF_CREDITS_MESSAGE,
  type AllowedMediaType,
} from "../rules/constants";
import type { ScanErrorCode } from "../types";
import {
  ClassificationSchema,
  RawExtractionSchema,
  type Classification,
  type RawExtraction,
} from "./schemas";
import { CLASSIFY_SYSTEM_PROMPT, EXTRACT_SYSTEM_PROMPT } from "./prompts";

/** Error carrying the HTTP-facing code, so the route does no guesswork. */
export class ScanPipelineError extends Error {
  constructor(
    readonly code: ScanErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ScanPipelineError";
  }
}

/**
 * Belt and braces: nothing that looks like an OpenRouter key may reach a
 * response body or a log line, even if an upstream error echoes our request.
 */
function redact(text: string): string {
  return text.replace(/sk-or-[A-Za-z0-9_-]+/g, "[redacted]");
}

/**
 * Read per-request rather than at module scope so that importing this file
 * (e.g. during `next build`) never throws on a missing key.
 */
function requireApiKey(): string {
  const apiKey = process.env[API_KEY_ENV_VAR];
  if (!apiKey) {
    // Loud and actionable: this is the most likely first failure after a
    // deploy. Never include the key itself in any message.
    throw new ScanPipelineError("server_misconfigured", MISSING_KEY_MESSAGE, 500);
  }
  return apiKey;
}

/**
 * A function's `parameters` is a plain JSON Schema. Zod v4's `toJSONSchema`
 * already emits `required` for every key and `additionalProperties: false`, so
 * the only fixup needed is dropping the `$schema` dialect key, which some
 * validators reject as an unknown keyword. One schema, one source of truth —
 * never a handwritten copy alongside the Zod one.
 */
function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface PassOptions<T> {
  stage: string;
  systemPrompt: string;
  userContent: string | ContentPart[];
  /** The one function this pass declares and expects the model to call. */
  toolName: string;
  toolDescription: string;
  schema: z.ZodType<T>;
}

/** Parse a printed whole-number quantity without accepting numeric prefixes. */
function parsePrintedQuantity(raw: string | null): number | null {
  if (raw === null) return null;
  const match = raw.trim().match(/^([1-9]\d*)(?:\.0+)?$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Return only an explicitly printed sellable-unit count.
 *
 * Accepted examples: 24 CT, 30 ROLL, 6/1 GAL, 16 / 3 #,
 * 24 x 5.3 OZ. Weight-only, grade and container descriptions such as 40 #,
 * 4x4, pint, bushel and box deliberately return null.
 */
function parseExplicitPackCount(raw: string | null): number | null {
  if (raw === null) return null;
  const normalized = raw.trim().replace(/\s+/g, " ");
  const countOnly = normalized.match(
    /^([1-9]\d*)\s*(?:ct|count|ea|each|rolls?|units?|packs?)$/i,
  );
  const multipack = normalized.match(
    /^([1-9]\d*)\s*(?:x|\/)\s*\d+(?:\.\d+)?\s*(?:fl\s*oz|oz|lbs?|#|gal|qts?|pts?|ml|l)$/i,
  );
  const match = countOnly ?? multipack;
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

/** Longest pack expression the strict parser accepts, e.g. "24 x 12 fl oz". */
const MAX_PACK_EXPRESSION_TOKENS = 5;

/**
 * Every explicit pack expression inside free text. Each candidate run of
 * words is judged by parseExplicitPackCount itself, so this search can never
 * accept a format the strict parser would reject.
 */
function explicitPackCountsIn(text: string): number[] {
  const tokens = text.trim().split(/\s+/);
  const counts: number[] = [];
  for (let start = 0; start < tokens.length; start++) {
    const last = Math.min(tokens.length, start + MAX_PACK_EXPRESSION_TOKENS);
    for (let end = start + 1; end <= last; end++) {
      const count = parseExplicitPackCount(tokens.slice(start, end).join(" "));
      if (count !== null) {
        counts.push(count);
        start = end - 1;
        break;
      }
    }
  }
  return counts;
}

/**
 * Full descriptions recognized as whole produce after known invoice metadata
 * is removed. Unknown words intentionally fail closed instead of relying on a
 * finite blacklist of prepared-food terms.
 */
const WHOLE_PRODUCE_DESCRIPTION_PATTERNS = [
  /^(?:(?:organic|fresh)\s+)*(?:(?:garnet|jewel|purple|white|sweet)\s+)?yams?(?:\s+(?:louisiana|mississippi)){0,2}$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:cooking|yellow|red|white|sweet|vidalia|spanish|pearl|green|spring)\s+)?onions?$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:roma|hydro|grape|cherry|plum|beefsteak|heirloom|green|red)\s+)?tomato(?:es)?(?:\s+(?:cluster|vine|grape)){0,2}$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:green|red|yellow|orange)\s+)?(?:(?:bell|sweet|chili|jalapeno|poblano)\s+)?peppers?(?:\s+(?:ex\s+large|extra\s+large|large|medium|small))?$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:select|english|persian|mini|seedless|garden|pickling)\s+)?cucumbers?$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:green|red|napa|savoy)\s+)?cabbages?$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:romaine|iceberg|green\s+leaf|red\s+leaf|butter|bibb|head)\s+)?lettuce(?:\s+(?:head|hearts?))?$/,
  /^(?:(?:organic|fresh)\s+)*celery(?:\s+(?:hearts?|stalks?|bunches?))?$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:green|yellow|ripe|baby)\s+)?bananas?(?:\s+(?:petite|premium|jumbo|large))?$/,
  /^(?:(?:organic|fresh)\s+)*(?:baby\s+)?broccoli(?:\s+(?:crowns?|bunches?))?$/,
  // Added after eval/RESULTS.md showed these four descriptions losing their
  // perishable flag: the list had no potato, lime or carrot at all, so a store
  // whose only fresh produce was potatoes read as carrying none.
  /^(?:(?:organic|fresh)\s+)*(?:(?:russet|red|white|gold(?:en)?|yukon|idaho|new|baby)\s+)?potato(?:es)?$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:persian|key|seedless)\s+)?limes?(?:\s+(?:persian|key|seedless))?$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:persian|meyer|seedless)\s+)?lemons?(?:\s+(?:meyer|seedless))?$/,
  /^(?:(?:organic|fresh)\s+)*(?:(?:baby|jumbo|cut|whole|bunch(?:ed)?)\s+)?carrots?$/,
];

function normalizeWholeProduceDescription(sourceLineText: string): string {
  return sourceLineText
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\s*\d+\s+/, " ")
    .replace(
      /\b\d+(?:\.\d+)?\s*(?:x|\/)\s*\d+(?:\.\d+)?(?:\s*(?:fl\s*oz|oz|lbs?|#|gal|qts?|pts?|ml|l))?(?=\s|$)/gi,
      " ",
    )
    .replace(
      /\b\d+(?:\.\d+)?\s*(?:ct|count|ea|each|rolls?|units?|packs?|fl\s*oz|oz|lbs?|#|gal|qts?|pts?|ml|l)(?=\s|$)/gi,
      " ",
    )
    .replace(/\b(?:cello\s+wrap|no\s+sleeve|pints?|bushels?|box(?:es)?|bags?|sacks?|cases?)\b/gi, " ")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isUnambiguouslyFreshWholeProduce(sourceLineText: string): boolean {
  const description = normalizeWholeProduceDescription(sourceLineText);
  return WHOLE_PRODUCE_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description));
}

function reconcileStorage(item: Classification["items"][number], sourceLineText: string) {
  if (
    item.category === "produce" &&
    item.storage === "shelf_stable" &&
    isUnambiguouslyFreshWholeProduce(sourceLineText)
  ) {
    return "fresh" as const;
  }
  return item.storage;
}

/**
 * Produce invoices often print the case count inside the description
 * ("Lettuce, Head 24 ct Cello Wrap") with no pack column, so pass 1 can leave
 * packSize empty or copy extra words into it. For whole fresh produce only,
 * accept a count when exactly one explicit expression appears. Packaged goods
 * are left alone on purpose: there "10 ct" in a name usually describes one
 * retail pack, and reading it as a case count would overcount.
 */
function packCountFromProduceText(
  item: Classification["items"][number],
  source: RawExtraction["lines"][number],
): number | null {
  if (item.category !== "produce" || !isUnambiguouslyFreshWholeProduce(source.lineText)) {
    return null;
  }
  // A leading number is the item-code column, never a pack.
  const texts = [source.packSize, source.lineText.replace(/^\s*\d+\s+/, "")];
  const found: number[] = [];
  for (const text of texts) {
    if (text === null) continue;
    const counts = explicitPackCountsIn(text);
    if (counts.length > 1) return null;
    found.push(...counts);
  }
  return found.length > 0 && found.every((count) => count === found[0]) ? found[0] : null;
}

/**
 * Bind pass 2 back to pass 1 and replace model-guessed factors with values
 * parsed from the transcription. This is the hard safety boundary before the
 * deterministic partition/rule engine sees model output.
 *
 * Exported because it is the layer that decides most of the arithmetic, so the
 * eval harness (eval/) replays recorded and authored model responses through it
 * directly, with no network in the way.
 */
export function reconcileClassification(
  raw: RawExtraction,
  classified: Classification,
): Classification {
  if (classified.items.length !== raw.lines.length) {
    throw new ScanPipelineError(
      "unparseable_model_output",
      `The model returned ${classified.items.length} classifications for ${raw.lines.length} extracted lines.`,
      502,
    );
  }

  return {
    items: classified.items.map((item, index) => {
      const source = raw.lines[index];
      if (item.sourceLineText !== source.lineText) {
        throw new ScanPipelineError(
          "unparseable_model_output",
          `The model changed or reordered an extracted source line during classification.`,
          502,
        );
      }

      return {
        ...item,
        quantity: parsePrintedQuantity(source.quantity),
        packCount:
          parseExplicitPackCount(source.packSize) ?? packCountFromProduceText(item, source),
        storage: reconcileStorage(item, source.lineText),
        excludeReason: source.legible
          ? item.excludeReason
          : "The transcribed line was not fully legible.",
      };
    }),
  };
}

/**
 * Maps an OpenRouter HTTP status onto our error codes. The codes themselves are
 * frozen — Role A builds against them — so new upstream failure modes have to
 * land on an existing one.
 */
function httpError(status: number, detail: string, stage: string): ScanPipelineError {
  if (status === 401 || status === 403) {
    return new ScanPipelineError(
      "server_misconfigured",
      `${API_KEY_ENV_VAR} was missing or rejected during ${stage}. Fix the value in the Vercel project settings, then REDEPLOY — environment variable changes do not apply to existing deployments.`,
      500,
    );
  }
  if (status === 402) {
    return new ScanPipelineError("server_misconfigured", OUT_OF_CREDITS_MESSAGE, 500);
  }
  if (status === 429) {
    return new ScanPipelineError("rate_limited", `Rate limited during ${stage}.`, 429);
  }
  if (status === 408 || status === 504) {
    return new ScanPipelineError(
      "upstream_unreachable",
      `OpenRouter timed out during ${stage}.`,
      504,
    );
  }
  // 404, and the 400s OpenRouter uses for "no endpoints for this model", both
  // mean the model id is wrong or no provider can serve it under our routing
  // constraints (see `require_parameters` below).
  if (status === 404 || /not found|no endpoints|no allowed providers/i.test(detail)) {
    return new ScanPipelineError(
      "upstream_error",
      `No OpenRouter provider available for "${MODEL}" during ${stage}${detail ? `: ${detail}` : "."}`,
      502,
    );
  }
  return new ScanPipelineError(
    "upstream_error",
    `OpenRouter error ${status} during ${stage}${detail ? `: ${detail}` : "."}`,
    502,
  );
}

/** Pull the human-readable part out of an error body without ever throwing. */
async function errorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: { message?: unknown } };
      const message = parsed?.error?.message;
      if (typeof message === "string" && message.length > 0) return redact(message);
    } catch {
      // Not JSON — fall through to the raw text.
    }
    return redact(text.slice(0, 500));
  } catch {
    return "";
  }
}

/** A single tool call as OpenRouter relays it. */
interface ToolCall {
  function?: { name?: unknown; arguments?: unknown };
}

/**
 * One tool-enabled round trip: build the request, map transport and HTTP
 * failures, then hold the tool call to the Zod schema before anything
 * downstream sees it.
 */
async function runPass<T>({
  stage,
  systemPrompt,
  userContent,
  toolName,
  toolDescription,
  schema,
}: PassOptions<T>): Promise<T> {
  const apiKey = requireApiKey();

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: MODEL_TEMPERATURE,
    reasoning: { effort: "none", exclude: true },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    // Exactly one tool, so there is nothing for the model to choose between.
    tools: [
      {
        type: "function",
        function: {
          name: toolName,
          description: toolDescription,
          parameters: toStrictJsonSchema(schema),
        },
      },
    ],
    // Do not send tool_choice: Nemotron's sole live provider accepts `tools`
    // but currently rejects every explicit tool_choice value before inference.
    // The response parser below still fails closed unless the model calls this
    // one declared function exactly once with schema-valid arguments.
    // Keeps OpenRouter from routing to a provider that would drop `tools`.
    provider: { require_parameters: true },
  };

  let response: Response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS),
    });
  } catch {
    // DNS, TLS, connection reset, or our own abort timeout.
    throw new ScanPipelineError(
      "upstream_unreachable",
      `Could not reach OpenRouter during ${stage}.`,
      504,
    );
  }

  if (!response.ok) {
    throw httpError(response.status, await errorDetail(response), stage);
  }

  let payload: {
    choices?: {
      message?: { refusal?: unknown; tool_calls?: unknown };
      finish_reason?: string | null;
    }[];
  };
  try {
    payload = await response.json();
  } catch {
    throw new ScanPipelineError(
      "upstream_error",
      `OpenRouter returned a non-JSON response during ${stage}.`,
      502,
    );
  }

  const choice = payload.choices?.[0];
  if (!choice) {
    throw new ScanPipelineError(
      "upstream_error",
      `OpenRouter returned no choices during ${stage}.`,
      502,
    );
  }

  const refusal = choice.message?.refusal;
  if (
    (typeof refusal === "string" && refusal.trim().length > 0) ||
    choice.finish_reason === "content_filter"
  ) {
    throw new ScanPipelineError(
      "model_refused",
      `The model declined to process this image during ${stage}.`,
      422,
    );
  }

  // From here down everything fails closed as unparseable_model_output.
  // `message.content` is never consulted: prose is not an answer.
  const truncated = choice.finish_reason === "length";
  const unparseable = (why: string) =>
    new ScanPipelineError(
      "unparseable_model_output",
      truncated
        ? `The model hit the ${MAX_TOKENS}-token output limit during ${stage}, cutting off its ${toolName} call.`
        : `${why} during ${stage}.`,
      502,
    );

  const toolCalls = choice.message?.tool_calls;
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    throw unparseable(`The model did not call ${toolName}`);
  }
  // Exactly one call, under exactly the expected name. Anything else — a second
  // call, a different function — means we cannot tell which answer was meant.
  if (toolCalls.length > 1) {
    throw unparseable(`The model returned ${toolCalls.length} tool calls instead of one`);
  }
  const call = toolCalls[0] as ToolCall;
  if (call?.function?.name !== toolName) {
    throw unparseable(`The model called an unexpected function instead of ${toolName}`);
  }

  // `arguments` is a JSON string per the OpenAI wire format; a few providers
  // send the object itself. Both go through Zod below, so neither is trusted.
  const rawArguments = call.function?.arguments;
  let parsed: unknown;
  if (typeof rawArguments === "string") {
    try {
      parsed = JSON.parse(rawArguments);
    } catch {
      throw unparseable(`The ${toolName} arguments were not valid JSON`);
    }
  } else if (rawArguments !== null && typeof rawArguments === "object") {
    parsed = rawArguments;
  } else {
    throw unparseable(`The ${toolName} call carried no arguments`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw unparseable(`The ${toolName} arguments did not match the expected schema`);
  }
  return result.data;
}

/** Pass 1: transcribe printed lines from the image. */
export async function extractRawLines(
  imageBase64: string,
  mediaType: AllowedMediaType,
): Promise<RawExtraction> {
  return runPass({
    stage: "extraction",
    systemPrompt: EXTRACT_SYSTEM_PROMPT,
    userContent: [
      // The image part comes BEFORE the text part.
      { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}` } },
      { type: "text", text: "Transcribe every printed product line in this image." },
    ],
    toolName: EXTRACT_TOOL_NAME,
    toolDescription:
      "Submit every printed product line transcribed verbatim from the image.",
    schema: RawExtractionSchema,
  });
}

/**
 * Pass 2 as the model answers it, before reconciliation.
 *
 * Separate from classifyLines so a caller that needs to record what the model
 * actually said — the eval harness does — can keep the raw answer instead of the
 * reconciled one.
 */
export async function classifyRawLines(raw: RawExtraction): Promise<Classification> {
  if (raw.lines.length === 0) return { items: [] };

  return runPass({
    stage: "classification",
    systemPrompt: CLASSIFY_SYSTEM_PROMPT,
    userContent: `Classify these transcribed invoice lines:\n\n${JSON.stringify(
      raw.lines,
      null,
      2,
    )}`,
    toolName: CLASSIFY_TOOL_NAME,
    toolDescription:
      "Submit one classified item for each transcribed invoice line, in order.",
    schema: ClassificationSchema,
  });
}

/** Pass 2: classify the transcribed lines, reconciled against the transcription. */
export async function classifyLines(raw: RawExtraction): Promise<Classification> {
  if (raw.lines.length === 0) return { items: [] };
  return reconcileClassification(raw, await classifyRawLines(raw));
}
