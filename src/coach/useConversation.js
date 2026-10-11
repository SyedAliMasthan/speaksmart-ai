import { useCallback, useEffect, useRef, useState } from "react";
import { coach, request } from "./api";
import { playback, record, toBase64 } from "./voice";
export default function useConversation(sessionId) {
  const [session, setSession] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const current = useRef(null);
  const active = useRef(null);
  const recording = useRef(null);
  const sound = useRef(null);
  const pendingTurn = useRef(null);
  const busy = useRef(false);
  const secondsRef = useRef(0);
  const update = (value) => {
    current.current = value;
    setSession(value);
  };
  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
    recording.current?.cancel();
    recording.current = null;
    sound.current?.stop();
    sound.current = null;
    busy.current = false;
    setLevel(0);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    busy.current = true;
    setState("loading");
    setError("");
    coach("session", { sessionId }, controller.signal)
      .then(({ session: value }) => {
        if (controller.signal.aborted) return;
        update(value);
        setState(value.status === "completed" ? "completed" : "ready");
        setSeconds(value.duration_seconds || 0);
        secondsRef.current = value.duration_seconds || 0;
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setState("error");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) busy.current = false;
      });
    return cancel;
  }, [sessionId, cancel]);
  useEffect(() => {
    if (!session || session.status === "completed") return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        secondsRef.current = Math.min(secondsRef.current + 1, 3600);
        setSeconds(secondsRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [session?.id, session?.status]);
  async function speakText(text, controller) {
    setState("speaking");
    const { audio } = await request(
      "voice/speak",
      { text: text.slice(0, 400), language: "en-IN" },
      controller.signal,
    );
    if (controller.signal.aborted) return;
    const player = playback(audio);
    sound.current = player;
    const result = await player.done;
    sound.current = null;
    if (result === "blocked")
      throw new Error(
        "Audio could not play. Your tutor’s reply is available in the transcript.",
      );
  }
  async function send(text, voice = false) {
    if (
      busy.current ||
      !text.trim() ||
      !current.current ||
      current.current.status !== "active"
    )
      return;
    busy.current = true;
    setError("");
    setState("thinking");
    const controller = new AbortController();
    active.current = controller;
    try {
      const snapshot = current.current;
      if (
        !pendingTurn.current ||
        pendingTurn.current.text !== text.trim() ||
        pendingTurn.current.revision !== snapshot.revision
      )
        pendingTurn.current = {
          turnId: crypto.randomUUID(),
          text: text.trim(),
          revision: snapshot.revision,
        };
      const { session: value } = await coach(
        "turn",
        {
          sessionId,
          ...pendingTurn.current,
          durationSeconds: secondsRef.current,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      update(value);
      pendingTurn.current = null;
      setDraft("");
      if (voice) await speakText(value.transcript.at(-1).content, controller);
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) {
        busy.current = false;
        setState("ready");
      }
    }
  }
  async function listen() {
    if (recording.current) {
      recording.current.stop();
      return;
    }
    if (busy.current || !current.current || current.current.status !== "active")
      return;
    busy.current = true;
    setError("");
    setState("recording");
    const controller = new AbortController();
    active.current = controller;
    try {
      const capture = await record({
        signal: controller.signal,
        onLevel: setLevel,
      });
      recording.current = capture;
      const blob = await capture.done;
      recording.current = null;
      if (controller.signal.aborted || !blob) return;
      if (blob.size > 512 * 1024)
        throw new Error("That recording was too long. Try a shorter answer.");
      setState("transcribing");
      const { text } = await request(
        "voice/transcribe",
        { audio: await toBase64(blob), mimeType: blob.type, language: "en-IN" },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!text.trim())
        throw new Error("No speech was recognised. Please try again.");
      setDraft(text);
      busy.current = false;
      await send(text, true);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e.message);
        busy.current = false;
        setState("ready");
      }
    }
  }
  async function repeat(text) {
    if (busy.current) return;
    const controller = new AbortController();
    active.current = controller;
    busy.current = true;
    setError("");
    try {
      await speakText(text, controller);
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) {
        busy.current = false;
        setState(
          current.current?.status === "completed" ? "completed" : "ready",
        );
      }
    }
  }
  async function complete() {
    if (busy.current || !current.current) return;
    busy.current = true;
    setError("");
    setState("saving");
    const controller = new AbortController();
    active.current = controller;
    try {
      const { session: value } = await coach(
        "complete",
        {
          sessionId,
          revision: current.current.revision,
          durationSeconds: secondsRef.current,
        },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        update(value);
        setState("completed");
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e.message);
        setState("ready");
      }
    } finally {
      if (!controller.signal.aborted) busy.current = false;
    }
  }
  const stop = () => {
    cancel();
    setState(current.current?.status === "completed" ? "completed" : "ready");
  };
  return {
    session,
    state,
    error,
    draft,
    setDraft,
    seconds,
    level,
    send,
    listen,
    repeat,
    complete,
    stop,
  };
}
