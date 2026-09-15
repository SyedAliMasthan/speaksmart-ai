/**
 * The call state machine.
 *
 *   idle → listening → thinking → speaking → listening → …
 *
 * One turn is: record until silence → Sarvam transcribe → /api/chat → Sarvam speak.
 * The learner never types. Each turn's scores are kept so the analysis screen can
 * show both per-sentence rings and a whole-call summary.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/callApi';
import { recordUtterance, playBase64Wav, isRecordingSupported, blobToBase64 } from '../lib/audio';

export default function useVoiceCall({ lessonId, language = 'en-IN', autoContinue = true }) {
  const [state, setState] = useState('idle');       // idle|listening|thinking|speaking|ended|error
  const [turns, setTurns] = useState([]);           // [{ role, content, scores?, correction? }]
  const [lastReply, setLastReply] = useState(null); // full parsed coach payload
  const [heard, setHeard] = useState('');           // what we transcribed this turn
  const [level, setLevel] = useState(0);            // mic level 0..1
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [facts, setFacts] = useState([]);

  const recorderRef = useRef(null);
  const playbackRef = useRef(null);
  const endedRef = useRef(false);
  const turnsRef = useRef([]);
  const supported = isRecordingSupported();

  useEffect(() => { turnsRef.current = turns; }, [turns]);

  // call timer
  useEffect(() => {
    if (state === 'idle' || state === 'ended') return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const stopEverything = useCallback(() => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    playbackRef.current?.stop();
    playbackRef.current = null;
  }, []);

  useEffect(() => () => stopEverything(), [stopEverything]);

  /** Speak the coach's reply, then hand the mic back. */
  const speakReply = useCallback(async (text) => {
    if (!text) return;
    setState('speaking');
    try {
      const { audio } = await api.speak(text, language);
      const playback = playBase64Wav(audio);
      playbackRef.current = playback;
      await playback.done;
    } catch (err) {
      // A voice failure should never kill the conversation — the text is on screen.
      console.warn('[voice]', err);
    } finally {
      playbackRef.current = null;
    }
  }, [language]);

  /** Send one learner utterance through the coach. */
  const sendTurn = useCallback(async (text) => {
    if (endedRef.current || !text?.trim()) return null;

    setState('thinking');
    setError('');

    const nextTurns = [...turnsRef.current, { role: 'user', content: text }];
    setTurns(nextTurns);

    try {
      const data = await api.chat({
        lessonId,
        messages: nextTurns.map(({ role, content }) => ({ role, content })),
        facts,
      });

      if (endedRef.current) return null;

      // Attach this turn's scores to the learner message that earned them.
      if (data.scores) {
        setTurns((prev) => {
          const copy = [...prev];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'user') {
              copy[i] = { ...copy[i], scores: data.scores, correction: {
                corrected: data.corrected, suggestion: data.suggestion,
                rule: data.rule, examples: data.examples,
              } };
              break;
            }
          }
          return [...copy, { role: 'assistant', content: data.reply }];
        });
      } else {
        setTurns((prev) => [...prev, { role: 'assistant', content: data.reply }]);
      }

      if (data.collectedFact) setFacts((f) => [...f, data.collectedFact].slice(-8));
      setLastReply(data);

      await speakReply(data.reply);
      return data;
    } catch (err) {
      if (endedRef.current) return null;
      setError(err.message || 'Liya could not answer. Tap the mic to try again.');
      setState('error');
      return null;
    }
  }, [lessonId, facts, speakReply]);

  /** Record one utterance, transcribe it, send it. */
  const listen = useCallback(async () => {
    if (endedRef.current) return;
    if (!supported) { setError('This browser cannot record audio. Try Chrome.'); setState('error'); return; }

    setError('');
    setHeard('');
    setState('listening');

    try {
      const rec = await recordUtterance({ onLevel: setLevel });
      recorderRef.current = rec;
      const result = await rec.done;
      recorderRef.current = null;
      setLevel(0);

      if (!result || endedRef.current) { if (!endedRef.current) setState('idle'); return; }

      if (result.blob.size > api.LIMITS.audioBytes) {
        setError('That was a long one — try a shorter sentence.');
        setState('error');
        return;
      }

      setState('thinking');
      const audio = await blobToBase64(result.blob);
      const { text } = await api.transcribe({ audio, mimeType: result.mimeType, language });

      if (!text?.trim()) {
        setError("I didn't catch that. Tap the mic and speak again.");
        setState('error');
        return;
      }

      setHeard(text);
      const data = await sendTurn(text);

      if (!endedRef.current && data && autoContinue) await listen();
      else if (!endedRef.current && data) setState('idle');
    } catch (err) {
      recorderRef.current = null;
      setLevel(0);
      if (endedRef.current) return;
      const message = err?.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow it in your browser settings.'
        : (err.message || 'Could not use the microphone.');
      setError(message);
      setState('error');
    }
  }, [supported, language, sendTurn, autoContinue]);

  const start = useCallback(async () => {
    endedRef.current = false;
    setSeconds(0);
    setTurns([]);
    setFacts([]);
    setError('');
    // Liya opens the call, exactly as Nova does — the learner never faces a blank screen.
    await sendTurn('__START__');
    if (!endedRef.current) await listen();
  }, [sendTurn, listen]);

  const interrupt = useCallback(() => {
    // Tapping the mic while Liya talks should cut her off, not queue behind her.
    playbackRef.current?.stop();
    playbackRef.current = null;
    recorderRef.current?.stop();
  }, []);

  const end = useCallback(() => {
    endedRef.current = true;
    stopEverything();
    setState('ended');
    return { turns: turnsRef.current, durationSeconds: seconds };
  }, [stopEverything, seconds]);

  const userTurnCount = turns.filter((t) => t.role === 'user' && t.content !== '__START__').length;

  return {
    state, turns, lastReply, heard, level, seconds, error, facts,
    supported, userTurnCount,
    start, listen, interrupt, end, sendTurn,
  };
}
