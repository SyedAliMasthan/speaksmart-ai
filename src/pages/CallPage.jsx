/**
 * The call screen — SpeakNova's interaction model in the old Lianna theme.
 *
 * Route: /call/:lessonId   (and /call for free-form)
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useVoiceCall from '../hooks/useVoiceCall';
import CallAvatar from '../components/CallAvatar';
import { ScoreRow } from '../components/ScoreRing';
import * as api from '../lib/callApi';

function formatClock(total) {
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallPage() {
  const { lessonId = 'free-conversation' } = useParams();
  const navigate = useNavigate();

  const call = useVoiceCall({ lessonId });
  const [started, setStarted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  const startedRef = useRef(false);

  // Autoplay rules mean the first audio must follow a user gesture — the Start tap.
  const handleStart = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    await call.start();
  };

  const handleEnd = async () => {
    // Under two turns there is nothing worth scoring. Nudge, as SpeakNova does.
    if (call.userTurnCount < 2) { setLeaving(true); return; }

    const { turns, durationSeconds } = call.end();
    setAnalysing(true);
    try {
      const res = await api.analyze({
        lessonId,
        transcript: turns.filter((t) => t.content !== '__START__'),
        durationSeconds,
      });
      if (res?.id) { navigate(`/call/analysis/${res.id}`); return; }
    } catch (err) {
      console.warn('[analyze]', err);
    }
    setAnalysing(false);
    navigate('/dashboard');
  };

  const leaveNow = () => { call.end(); navigate('/dashboard'); };

  useEffect(() => {
    const warn = (e) => { if (started && call.state !== 'ended') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [started, call.state]);

  const lastUserTurn = [...call.turns].reverse().find((t) => t.role === 'user' && t.scores);
  const micBusy = call.state === 'thinking';

  return (
    <div className="sn-app">
      <span className="sn-orb sn-orb-1" aria-hidden="true" />
      <span className="sn-orb sn-orb-2" aria-hidden="true" />

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                       paddingBlock: 16, zIndex: 1 }}>
        <button className="sn-btn sn-btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}
                onClick={() => (started ? setLeaving(true) : navigate(-1))}>
          ← Back
        </button>
        <span className="sn-timer">{formatClock(call.seconds)}</span>
        <button className="sn-btn sn-btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}
                onClick={() => setShowTranscript((v) => !v)}>
          {showTranscript ? 'Hide' : 'Transcript'}
        </button>
      </header>

      <main className="sn-call">
        <CallAvatar state={started ? call.state : 'idle'} level={call.level} />

        {!started && (
          <>
            <h1 className="sn-h1 sn-gradient-text">Talk with Liya</h1>
            <p className="sn-muted" style={{ maxWidth: 320 }}>
              Speak naturally. She listens, corrects gently, and scores every sentence.
            </p>
            <button className="sn-btn sn-pulse" onClick={handleStart}>Start the call</button>
            {!call.supported && (
              <div className="sn-alert">
                This browser can’t record audio. Chrome on Android or desktop works best.
              </div>
            )}
          </>
        )}

        {started && (
          <>
            {call.heard && (
              <div className="sn-transcript">
                <strong>You said:</strong> “{call.heard}”
              </div>
            )}

            {lastUserTurn?.scores && <ScoreRow scores={lastUserTurn.scores} />}

            {lastUserTurn?.correction?.corrected && (
              <div className="sn-card sn-correction">
                <span className="sn-label">Correction</span>
                <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6 }}>
                  <span className="sn-wrong">{lastUserTurn.content}</span><br />
                  <span className="sn-right">{lastUserTurn.correction.corrected}</span>
                </p>
                {lastUserTurn.correction.rule && (
                  <div className="sn-rule">{lastUserTurn.correction.rule}</div>
                )}
                {Array.isArray(lastUserTurn.correction.examples) && (
                  <ul className="sn-examples">
                    {lastUserTurn.correction.examples.slice(0, 3).map((ex, i) => <li key={i}>{ex}</li>)}
                  </ul>
                )}
              </div>
            )}

            {call.lastReply?.reply && (
              <div className="sn-transcript">
                <strong>Liya:</strong> “{call.lastReply.reply}”
              </div>
            )}

            {call.error && <div className="sn-alert">{call.error}</div>}

            <button
              className={`sn-mic ${call.state === 'listening' ? 'recording' : ''}`}
              onClick={call.state === 'speaking' ? call.interrupt : call.listen}
              disabled={micBusy}
              aria-label={call.state === 'listening' ? 'Stop recording' : 'Speak'}
            >
              {call.state === 'listening' ? '■' : '🎤'}
            </button>

            <p className="sn-muted" style={{ fontSize: 13 }}>
              {call.state === 'listening' ? 'Speak — I’ll stop when you pause'
                : call.state === 'speaking' ? 'Tap the mic to interrupt'
                : call.state === 'thinking' ? 'One moment…'
                : 'Tap the mic to speak'}
            </p>

            <button className="sn-btn sn-btn-danger" onClick={handleEnd} disabled={analysing}>
              {analysing ? 'Scoring your call…' : 'End call'}
            </button>
          </>
        )}

        {showTranscript && call.turns.length > 0 && (
          <div className="sn-card" style={{ width: '100%', maxWidth: 400, textAlign: 'left' }}>
            <span className="sn-label">Transcript</span>
            <div className="sn-stack" style={{ marginTop: 10 }}>
              {call.turns.filter((t) => t.content !== '__START__').map((t, i) => (
                <p key={i} style={{ fontSize: 14, lineHeight: 1.6,
                                    color: t.role === 'user' ? 'var(--ink)' : 'var(--muted)' }}>
                  <strong style={{ color: t.role === 'user' ? 'var(--purple)' : 'var(--cyan)' }}>
                    {t.role === 'user' ? 'You' : 'Liya'}:
                  </strong>{' '}
                  {t.content}
                </p>
              ))}
            </div>
          </div>
        )}
      </main>

      {leaving && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,3,10,0.88)',
                      display: 'grid', placeItems: 'center', padding: 20, zIndex: 10 }}>
          <div className="sn-card" style={{ maxWidth: 340, textAlign: 'center' }}>
            <h2 className="sn-h2">Leaving already?</h2>
            <p className="sn-muted" style={{ marginTop: 8 }}>
              Say two or three more sentences and I can score this call.
            </p>
            <div className="sn-stack" style={{ marginTop: 16 }}>
              <button className="sn-btn" onClick={() => { setLeaving(false); call.listen(); }}>
                Keep going
              </button>
              <button className="sn-btn sn-btn-ghost" onClick={leaveNow}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
