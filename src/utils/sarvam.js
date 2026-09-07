import { apiRequest } from './api';
let currentAudio = null;
let speechGeneration = 0;
export async function transcribeAudio(audioBlob) {
  if (audioBlob.size > 4 * 1024 * 1024) throw new Error('Please record a shorter answer.');
  const audio = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });
  return apiRequest('/api/voice/transcribe', { audio, mimeType: audioBlob.type, language: 'en-IN' });
}
export async function speakWithLiya(text, language = 'en-IN') {
  if (typeof text !== 'string' || !text.trim()) return;
  stopSpeaking(); const generation = speechGeneration;
  if (localStorage.getItem('speaksmart_voice') === 'browser') return fallbackSpeak(text);
  try {
    const data = await apiRequest('/api/voice/speak', { text: text.slice(0, 2000), language });
    if (generation !== speechGeneration) return;
    currentAudio = new Audio(`data:audio/wav;base64,${data.audio}`); await currentAudio.play();
  } catch { if (generation === speechGeneration) fallbackSpeak(text); }
}
export function stopSpeaking() {
  speechGeneration++;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  window.speechSynthesis?.cancel();
}
function fallbackSpeak(text) {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-IN'; utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}
