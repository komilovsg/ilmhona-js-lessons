// Server-only: the mentor's upstream model chain and the shared quota/log store built from it.
import { minuteGate, nextPacificMidnight } from './mentor-server';
import { createMentorStore, type MentorStore } from './mentor-store';

// Models: https://ai.google.dev/gemini-api/docs/models
// Model ids verified with the models list endpoint on 2026-10-16 (note: Gemini 3 Flash is "gemini-3-flash-preview").
// Free-tier limits per model from the owner's AI Studio rate-limit page, 2026-10-16. Each model has its own quota, so the chain
// rotates: a model at its RPM (own gate, a bit under) or whose 429 says exhausted is skipped, the request goes to the next one.
// Quotas are per Google Cloud project, not per key: never add projects/keys to multiply them (against Google's terms).
// think: thinkingConfig per model; a 400 retries once without it (runChain). rpd is the free-tier requests per day.
// key: opaque id stored in Supabase (mentor_model_usage / mentor_log); the vendor id is mapped only here, in server code.
export const CHAIN = [
  { key: 'm1', id: 'gemini-3.5-flash-lite', rpm: 14, rpd: 500, think: { thinkingLevel: 'minimal' } },
  { key: 'm2', id: 'gemini-2.5-flash-lite', rpm: 9, rpd: 20, think: { thinkingBudget: 0 } },
  { key: 'm3', id: 'gemini-3.8-flash', rpm: 4, rpd: 20, think: { thinkingLevel: 'minimal' } },
  { key: 'm4', id: 'gemini-3-flash-preview', rpm: 4, rpd: 20, think: { thinkingLevel: 'minimal' } },
  { key: 'm5', id: 'gemini-3.6-flash', rpm: 4, rpd: 20, think: { thinkingBudget: 0 } },
  { key: 'm6', id: 'gemini-2.5-flash', rpm: 4, rpd: 20, think: { thinkingBudget: 0 } },
] as const;

const g = globalThis as { __mentorStore?: MentorStore };

/** One store per server instance, shared by /api/mentor and /api/mentor/status. */
export function getMentorStore(): MentorStore {
  return (g.__mentorStore ??= createMentorStore(
    CHAIN.map(({ key, id, rpm, rpd }) => ({ key, id, rpm, rpd })),
    { gate: minuteGate, nextMidnight: nextPacificMidnight },
  ));
}
