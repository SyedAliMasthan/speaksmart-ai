// Each capture and playback owns its resources and settles exactly once.
export function supportedRecording() {
  return !!(navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder);
}
export async function record({ signal, onLevel = () => {} } = {}) {
  if (!supportedRecording())
    throw new Error(
      "Microphone recording is unavailable here. You can type your answer.",
    );
  const types = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/webm",
  ];
  const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType)
    throw new Error(
      "This browser cannot record a supported format. You can type your answer.",
    );
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  if (signal?.aborted) {
    stream.getTracks().forEach((t) => t.stop());
    throw new DOMException("Cancelled", "AbortError");
  }
  let context;
  try {
    context = new (window.AudioContext || window.webkitAudioContext)();
    await context.resume();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    let frame;
    let timer;
    let settled = false;
    let hasSpeech = false;
    let quietSince = 0;
    let finish;
    const done = new Promise((resolve, reject) => {
      finish = (error, cancelled = false) => {
        if (settled) return;
        settled = true;
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        stream.getTracks().forEach((t) => t.stop());
        context.close().catch(() => {});
        onLevel(0);
        if (error) reject(error);
        else
          resolve(
            cancelled
              ? null
              : new Blob(chunks, { type: mimeType.split(";")[0] }),
          );
      };
    });
    const stop = () => {
      if (recorder.state === "recording") recorder.stop();
    };
    const abort = () => {
      stop();
      finish(null, true);
    };
    signal?.addEventListener("abort", abort, { once: true });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      stop();
      finish(new Error("Recording failed. Please retry or type your answer."));
    };
    recorder.onstop = () => finish();
    recorder.start();
    timer = setTimeout(stop, 25000);
    const data = new Float32Array(analyser.fftSize);
    function tick() {
      if (settled || recorder.state !== "recording") return;
      analyser.getFloatTimeDomainData(data);
      const rms = Math.sqrt(
        data.reduce((sum, n) => sum + n * n, 0) / data.length,
      );
      onLevel(Math.min(1, rms * 8));
      if (rms > 0.018) {
        hasSpeech = true;
        quietSince = 0;
      } else if (hasSpeech) {
        if (!quietSince) quietSince = Date.now();
        if (Date.now() - quietSince > 1800) return stop();
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return { done, stop, cancel: abort };
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    context?.close().catch(() => {});
    throw error;
  }
}
export function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read recording."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
}
export function playback(base64) {
  const url = URL.createObjectURL(
    new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
      type: "audio/wav",
    }),
  );
  const audio = new Audio(url);
  let settled = false;
  let finish;
  const done = new Promise((resolve) => {
    finish = (status) => {
      if (settled) return;
      settled = true;
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      URL.revokeObjectURL(url);
      resolve(status);
    };
  });
  audio.onended = () => finish("ended");
  audio.onerror = () => finish("blocked");
  audio.play().catch(() => finish("blocked"));
  return { done, stop: () => finish("stopped") };
}
