// ═══════════════════════════════════════════════════════════════
// Lightweight Analytics — PostHog (optional, self-hostable)
// No payment tracking, no third-party ad trackers
// ═══════════════════════════════════════════════════════════════

const enabled = typeof window !== 'undefined' && window.posthog;

export function trackEvent(name, props = {}) {
  if (enabled) window.posthog.capture(name, props);
}

export function identifyUser(userId, traits = {}) {
  if (enabled) window.posthog.identify(userId, traits);
}

export function resetUser() {
  if (enabled) window.posthog.reset();
}

export const analytics = {
  // Acquisition
  landingView: () => trackEvent('landing_viewed'),
  signupCompleted: (method) => trackEvent('signup_completed', { method }),
  loginCompleted: (method) => trackEvent('login_completed', { method }),

  // Learning
  lessonStarted: (id, title) => trackEvent('lesson_started', { lesson_id: id, title }),
  lessonCompleted: (id, score, dur) => trackEvent('lesson_completed', { lesson_id: id, score, duration_s: dur }),
  practiceStarted: (topic) => trackEvent('practice_started', { topic }),
  practiceCompleted: (topic, score) => trackEvent('practice_completed', { topic, score }),
  voiceUsed: (method) => trackEvent('voice_used', { method }),
  vocabSaved: (word) => trackEvent('vocab_saved', { word }),
  streakHit: (days) => trackEvent('streak_hit', { days }),

  // Errors
  error: (type, msg) => trackEvent('error', { type, message: msg }),
};
