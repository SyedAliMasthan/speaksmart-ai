/**
 * The pulsing avatar at the centre of the call screen — SpeakNova's strongest
 * UI idea. One glance tells the learner whose turn it is.
 */

const COPY = {
  idle:      { text: 'Ready',        tone: 'online' },
  listening: { text: 'Listening…',   tone: 'listening' },
  thinking:  { text: 'Thinking…',    tone: 'thinking' },
  speaking:  { text: 'Liya speaking', tone: 'speaking' },
  error:     { text: 'Connection trouble', tone: 'error' },
};

export default function CallAvatar({ state = 'idle', level = 0 }) {
  const { text, tone } = COPY[state] || COPY.idle;
  const ringClass =
    state === 'speaking' ? 'is-speaking' :
    state === 'listening' ? 'is-listening' : '';

  // While listening, the avatar breathes with the learner's own voice.
  const scale = state === 'listening' ? 1 + Math.min(level, 1) * 0.08 : 1;

  return (
    <>
      <div className="sn-avatar-wrap">
        <span className={`sn-avatar-ring ${ringClass}`} aria-hidden="true" />
        <span className={`sn-avatar-ring ${ringClass}`} aria-hidden="true"
              style={{ animationDelay: '0.5s' }} />
        <div
          className="sn-avatar"
          style={{ transform: `scale(${scale})`, transition: 'transform .12s linear' }}
          aria-hidden="true"
        >
          ✦
        </div>
      </div>
      <p className={`sn-status ${tone}`} role="status" aria-live="polite">{text}</p>
    </>
  );
}
