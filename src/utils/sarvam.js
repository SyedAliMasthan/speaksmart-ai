// ═══════════════════════════════════════════════════════════════
// Sarvam AI Voice Integration
// STT: Saaras v3 (22 Indian languages + English, auto-detect)
// TTS: Bulbul v3 (female voice: Kavya — warm conversational tone)
// ═══════════════════════════════════════════════════════════════

const SARVAM_KEY = import.meta.env.VITE_SARVAM_API_KEY;
const STT_URL = 'https://api.sarvam.ai/speech-to-text';
const TTS_URL = 'https://api.sarvam.ai/text-to-speech';

// ─── Liya's voice config ───
// Priya = "Upbeat voice with personality" (female)
// Alternatives: Kavya (conversational), Simran (warm), Pooja (encouraging)
const LIYA_VOICE = 'Priya';
const LIYA_PACE = 0.95;  // slightly slower for learners

// ─── SPEECH TO TEXT (user's voice → text) ───
// Uses Saaras v3 with auto language detection
// Handles Tamil, Hindi, Telugu, English, and code-mixed speech
export async function transcribeAudio(audioBlob) {
  if (!SARVAM_KEY) {
    console.warn('[Sarvam] No API key — falling back to browser STT');
    return null;
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model', 'saaras:v3');
  formData.append('language_code', 'unknown'); // auto-detect
  formData.append('mode', 'transcribe');

  try {
    const res = await fetch(STT_URL, {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_KEY },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Sarvam STT] Error:', res.status, err);
      return null;
    }

    const data = await res.json();
    return {
      text: data.transcript || '',
      language: data.language_code || 'unknown',
      confidence: data.language_confidence || 0,
    };
  } catch (err) {
    console.error('[Sarvam STT] Network error:', err);
    return null;
  }
}

// ─── TEXT TO SPEECH (Liya speaks → user hears) ───
// Uses Bulbul v3 with Kavya voice
// Returns audio as base64 and plays it
export async function speakWithLiya(text, language = 'en-IN') {
  if (!SARVAM_KEY) {
    // Fallback: browser TTS
    fallbackSpeak(text);
    return;
  }

  try {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': SARVAM_KEY,
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: language,
        speaker: LIYA_VOICE,
        model: 'bulbul:v3',
        pace: LIYA_PACE,
        enable_preprocessing: true,
      }),
    });

    if (!res.ok) {
      console.warn('[Sarvam TTS] Error, falling back to browser:', res.status);
      fallbackSpeak(text);
      return;
    }

    const data = await res.json();
    if (data.audios && data.audios[0]) {
      playBase64Audio(data.audios[0]);
    } else {
      fallbackSpeak(text);
    }
  } catch (err) {
    console.warn('[Sarvam TTS] Network error, falling back:', err);
    fallbackSpeak(text);
  }
}

// ─── Play base64 audio ───
let currentAudio = null;

function playBase64Audio(base64) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  const audio = new Audio(`data:audio/wav;base64,${base64}`);
  audio.playbackRate = 1.0;
  currentAudio = audio;
  audio.play().catch(() => {});
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ─── Fallback: Browser TTS (when Sarvam key not set) ───
function fallbackSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92; u.pitch = 1.1;
  const pick = () => {
    const v = window.speechSynthesis.getVoices();
    const tests = [
      x => x.name.includes('Google UK English Female'),
      x => x.name.includes('Samantha'),
      x => x.name.includes('Zira'),
      x => x.name.includes('Female') && x.lang.startsWith('en'),
      x => x.lang.startsWith('en'),
    ];
    for (const t of tests) { const f = v.find(t); if (f) return f; }
    return v[0];
  };
  const v = window.speechSynthesis.getVoices();
  if (v.length) { u.voice = pick(); window.speechSynthesis.speak(u); }
  else { window.speechSynthesis.onvoiceschanged = () => { u.voice = pick(); window.speechSynthesis.speak(u); }; }
}
