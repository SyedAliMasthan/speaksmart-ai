/**
 * Thin client for the SpeakSmart authenticated API (127.0.0.1:3001 behind nginx).
 *
 * Every call carries the Supabase access token as a bearer. The server verifies it
 * against /auth/v1/user, enforces email confirmation, and spends one quota unit
 * (200/day, 20/minute) before touching a provider.
 */

import { supabase } from '../config/supabase';

const BASE = '/api';

/** Server caps: 400 chars of speech text, 512KB of audio. Mirror them client-side. */
export const LIMITS = {
  speechChars: 400,
  audioBytes: 512 * 1024,
  maxMessages: 20,
  messageChars: 2000,
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new ApiError(401, 'Sign in to continue.');
  return `Bearer ${token}`;
}

async function post(path, body, { timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: await authHeader(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Connection lost. Check your network and try again.');
  }
  clearTimeout(timer);

  let payload = null;
  try { payload = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok) {
    // The server already writes learner-facing messages; surface them verbatim.
    throw new ApiError(res.status, payload?.error || 'Something went wrong. Try again.');
  }
  return payload;
}

/** One coaching turn. Returns { reply, corrected, suggestion, followUpQuestion,
 *  collectedFact, isComplete, finalParagraph, scores? } */
export function chat({ lessonId, messages, facts = [] }) {
  return post('/chat', {
    lessonId,
    messages: messages.slice(-LIMITS.maxMessages),
    facts: facts.slice(-8),
  });
}

/** Sarvam bulbul:v3, speaker "priya". Returns { audio: base64 wav }. */
export function speak(text, language = 'en-IN') {
  return post('/voice/speak', { text: String(text).slice(0, LIMITS.speechChars), language },
    { timeoutMs: 40000 });
}

/** Sarvam saaras:v3. Returns { text, confidence }. */
export function transcribe({ audio, mimeType, language = 'en-IN' }) {
  return post('/voice/transcribe', { audio, mimeType, language }, { timeoutMs: 40000 });
}

/** End-of-call scoring. Requires the server patch in server-patch.md. */
export function analyze({ sessionId, lessonId, transcript, durationSeconds }) {
  return post('/coach/analyze', { sessionId, lessonId, transcript, durationSeconds },
    { timeoutMs: 45000 });
}

export async function health() {
  const res = await fetch(BASE + '/health');
  return res.json();
}
