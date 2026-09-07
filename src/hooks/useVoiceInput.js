import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudio } from '../utils/sarvam';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const HAS_SARVAM = true;

export function useVoiceInput({ language = 'en-IN', onResult, onError }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recRef = useRef(null);
  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null); const timerRef = useRef(null); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false; clearTimeout(timerRef.current);
    if (mrRef.current) { mrRef.current.onstop = null; if (mrRef.current.state === 'recording') mrRef.current.stop(); }
    streamRef.current?.getTracks().forEach(t=>t.stop()); recRef.current?.abort();
  }; }, []);

  // ─── SARVAM PATH: Record audio → send to Saaras v3 ───
  const startSarvamRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
      if (!mounted.current) { stream.getTracks().forEach(t=>t.stop()); return; }
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/mp4';
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        clearTimeout(timerRef.current); stream.getTracks().forEach(t => t.stop());
        if (!mounted.current) return;
        setIsListening(false);
        setIsProcessing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const result = await transcribeAudio(blob);
          if (!mounted.current) return;
          if (result && result.text) {
            setTranscript(result.text);
            onResult?.(result.text, result.confidence);
          } else {
            onError?.('transcription-empty');
          }
        } catch { onError?.('transcription-failed'); }
        finally { setIsProcessing(false); }
      };

      mrRef.current = mr;
      mr.start(250);
      timerRef.current = setTimeout(()=>{ if(mr.state === 'recording') mr.stop(); }, 60000);
      setIsListening(true);
    } catch { streamRef.current?.getTracks().forEach(t=>t.stop()); onError?.('mic-not-available'); }
  }, [onResult, onError]);

  // ─── BROWSER FALLBACK: Web Speech API (Chrome only) ───
  const startBrowserSTT = useCallback(() => {
    if (!SpeechRecognition) { onError?.('not-supported'); return; }
    const rec = new SpeechRecognition();
    rec.lang = language;
    rec.continuous = false;
    rec.interimResults = true;
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      setTranscript(r[0].transcript);
      if (r.isFinal) onResult?.(r[0].transcript, r[0].confidence);
    };
    rec.onerror = (e) => { setIsListening(false); onError?.(e.error); };
    rec.onend = () => setIsListening(false);
    recRef.current = rec;
    rec.start();
  }, [language, onResult, onError]);

  // ─── PUBLIC API ───
  const startListening = useCallback(() => {
    setTranscript('');
    // Prefer Sarvam (works on ALL browsers, understands Indian languages)
    // Fall back to browser STT only if no Sarvam key
    if (HAS_SARVAM) {
      startSarvamRecording();
    } else if (SpeechRecognition) {
      startBrowserSTT();
    } else {
      startSarvamRecording(); // try mic recording anyway
    }
  }, [startSarvamRecording, startBrowserSTT]);

  const stopListening = useCallback(() => {
    if (mrRef.current && mrRef.current.state === 'recording') {
      mrRef.current.stop();
    }
    if (recRef.current) {
      recRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return { isListening, isProcessing, transcript, startListening, stopListening };
}

