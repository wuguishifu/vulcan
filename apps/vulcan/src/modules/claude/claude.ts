import { invoke } from '@tauri-apps/api/core';

export interface ClaudeModel {
  id: string;
  displayName: string;
}

/**
 * Shown when the live model list can't be fetched (no token saved, offline,
 * invalid token). Ordered most- to least-capable.
 */
export const FALLBACK_CLAUDE_MODELS: readonly ClaudeModel[] = [
  { id: 'claude-opus-5', displayName: 'Claude Opus 5' },
  { id: 'claude-sonnet-5', displayName: 'Claude Sonnet 5' },
  { id: 'claude-opus-4-8', displayName: 'Claude Opus 4.8' },
  { id: 'claude-opus-4-7', displayName: 'Claude Opus 4.7' },
  { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5', displayName: 'Claude Haiku 4.5' },
];

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5';

/** Live model list from the API; the token stays on the Rust side. */
export function claudeListModels(): Promise<ClaudeModel[]> {
  return invoke('claude_list_models');
}

/**
 * Single-turn request; resolves to the concatenated text of the response.
 * Rejects with a human-readable message (invalid token, rate limit, refusal).
 */
export function claudeSendMessage(args: {
  model: string;
  system: string;
  userMessage: string;
  maxTokens: number;
}): Promise<string> {
  return invoke('claude_send_message', args);
}

export type ClaudeClipResult =
  | {
      found: true;
      reasoning: string;
      quote_start: string;
      quote_end: string;
      start_seconds: number;
      end_seconds: number;
      clip_title: string;
    }
  | { found: false; reasoning: string };

/**
 * Parses the model's clip-selection response. The prompt demands bare JSON,
 * but code fences are stripped defensively anyway.
 */
export function parseClipResult(text: string): ClaudeClipResult {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`model returned unparseable JSON: ${text.slice(0, 200)}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('model response is not a JSON object');
  }

  const result = parsed as Record<string, unknown>;
  if (typeof result.reasoning !== 'string') {
    throw new Error('model response is missing "reasoning"');
  }

  if (result.found === false) {
    return { found: false, reasoning: result.reasoning };
  }
  if (result.found !== true) {
    throw new Error('model response is missing "found"');
  }
  if (
    typeof result.quote_start !== 'string' ||
    typeof result.quote_end !== 'string' ||
    typeof result.clip_title !== 'string' ||
    typeof result.start_seconds !== 'number' ||
    typeof result.end_seconds !== 'number'
  ) {
    throw new Error('model response is missing clip fields');
  }
  if (result.end_seconds <= result.start_seconds) {
    throw new Error(
      `model returned an empty range: ${result.start_seconds} to ${result.end_seconds}`,
    );
  }
  return {
    found: true,
    reasoning: result.reasoning,
    quote_start: result.quote_start,
    quote_end: result.quote_end,
    start_seconds: result.start_seconds,
    end_seconds: result.end_seconds,
    clip_title: result.clip_title,
  };
}
