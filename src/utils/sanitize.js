// ═══════════════════════════════════════════════════════════════
// Input Sanitization — Anti-XSS utility
// Use on ALL user inputs before rendering or sending to API
// ═══════════════════════════════════════════════════════════════

const ENTITY_MAP = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;',
  '"': '&quot;', "'": '&#x27;', '/': '&#x2F;',
  '`': '&#96;',
};

// Escape HTML entities — prevents XSS in rendered text
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'\/`]/g, (c) => ENTITY_MAP[c]);
}

// Strip all HTML tags
export function stripHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '');
}

// Sanitize user input for API calls — trim, limit length, strip control chars
export function sanitizeInput(str, maxLength = 2000) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // strip control chars
}

// Validate email format
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Rate limiter (client-side — server-side is the real gate)
export function createRateLimiter(maxCalls, windowMs) {
  const calls = [];
  return function canProceed() {
    const now = Date.now();
    const recent = calls.filter(t => now - t < windowMs);
    if (recent.length >= maxCalls) return false;
    calls.length = 0;
    calls.push(...recent, now);
    return true;
  };
}

// Prevent prototype pollution in JSON parsing
export function safeParse(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object') {
      delete parsed.__proto__;
      delete parsed.constructor;
      delete parsed.prototype;
    }
    return parsed;
  } catch {
    return null;
  }
}
