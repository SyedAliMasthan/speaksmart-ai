/**
 * Microphone capture with voice-activity detection, and WAV playback.
 *
 * SpeakNova uses the browser's webkitSpeechRecognition, which is Chrome-only and
 * never sends audio anywhere. We record real audio and post it to Sarvam, so this
 * works on Firefox and iOS Safari too — and the server actually hears the learner.
 */

/** Pick a container the server's AUDIO_TYPES whitelist accepts. */
export function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',   // Chrome, Edge, Firefox
    'audio/webm',
    'audio/mp4',                // Safari / iOS
    'audio/ogg;codecs=opus',
  ];
  if (typeof MediaRecorder === 'undefined') return null;
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

export function isRecordingSupported() {
  return !!(navigator.mediaDevices?.getUserMedia && pickMimeType());
}

/** Blob → bare base64 (no data: prefix). The server rejects base64url and padding errors. */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the recording.'));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Record until the learner stops talking.
 *
 * Returns a handle: { stop(), cancel(), done } where `done` resolves to
 * { blob, mimeType, durationMs } or null if cancelled.
 *
 * VAD: we watch RMS from an AnalyserNode. Once speech has been detected, a
 * silenceMs-long quiet stretch ends the turn — the same "one utterance per turn"
 * feel as SpeakNova, without depending on Chrome's speech engine.
 */
export async function recordUtterance({
  silenceMs = 1500,
  maxMs = 30000,
  minSpeechMs = 400,
  threshold = 0.012,
  onLevel,
} = {}) {
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error('This browser cannot record audio.');

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const startedAt = Date.now();
  let cancelled = false;
  let raf = null;
  let hardStop = null;

  const cleanup = () => {
    if (raf) cancelAnimationFrame(raf);
    if (hardStop) clearTimeout(hardStop);
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };

  const done = new Promise((resolve) => {
    recorder.onstop = () => {
      cleanup();
      if (cancelled) return resolve(null);
      resolve({
        blob: new Blob(chunks, { type: mimeType }),
        mimeType: mimeType.split(';')[0],   // server matches on the bare type
        durationMs: Date.now() - startedAt,
      });
    };
  });

  recorder.start();
  hardStop = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, maxMs);

  // ── voice activity detection ──
  const buf = new Float32Array(analyser.fftSize);
  let speechStartedAt = 0;
  let quietSince = 0;

  const tick = () => {
    if (recorder.state !== 'recording') return;
    analyser.getFloatTimeDomainData(buf);

    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    onLevel?.(Math.min(1, rms / 0.25));

    const now = Date.now();
    if (rms > threshold) {
      if (!speechStartedAt) speechStartedAt = now;
      quietSince = 0;
    } else if (speechStartedAt && now - speechStartedAt > minSpeechMs) {
      if (!quietSince) quietSince = now;
      else if (now - quietSince > silenceMs) { recorder.stop(); return; }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop() { if (recorder.state === 'recording') recorder.stop(); },
    cancel() { cancelled = true; if (recorder.state === 'recording') recorder.stop(); else cleanup(); },
    done,
  };
}

/** Play base64 WAV from /api/voice/speak. Resolves when playback ends. */
export function playBase64Wav(base64, { onEnded } = {}) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  const audio = new Audio(url);

  const done = new Promise((resolve) => {
    const finish = () => { URL.revokeObjectURL(url); onEnded?.(); resolve(); };
    audio.onended = finish;
    audio.onerror = finish;
  });

  // Autoplay can be refused until the user has interacted; the mic tap covers that.
  audio.play().catch(() => { URL.revokeObjectURL(url); onEnded?.(); });
  return { audio, done, stop() { audio.pause(); audio.currentTime = 0; URL.revokeObjectURL(url); } };
}
