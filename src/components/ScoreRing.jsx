/**
 * The score ring from the original Lianna build — GRM / PRN / FLU / ALL.
 *
 * This is the piece SpeakNova does not have: they score once at the end of a call,
 * we score every sentence as it is spoken.
 */

const COLORS = {
  GRM: 'var(--grm)',
  PRN: 'var(--prn)',
  FLU: 'var(--flu)',
  ALL: 'var(--all)',
  VOC: 'var(--cyan)',
  TOP: 'var(--pink)',
};

export default function ScoreRing({ label, value, size = 34, perfect = false }) {
  const score = Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0;
  const color = perfect ? 'var(--all-perfect)' : (COLORS[label] || 'var(--purple)');

  const r = size / 2 - 3;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 10) * circumference;

  return (
    <div className="sn-score">
      <div className="sn-score-ring" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ filter: `drop-shadow(0 0 ${perfect ? 6 : 3}px ${color})`, transform: 'rotate(-90deg)' }}
          role="img"
          aria-label={`${label} score ${score} out of 10`}
        >
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="rgba(196,113,245,0.14)" strokeWidth="3"
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray .6s cubic-bezier(.16,.9,.28,1)' }}
          />
        </svg>
        <span className="sn-score-val" style={{ color }}>{score}</span>
      </div>
      <span className="sn-score-label">{label}</span>
    </div>
  );
}

/** The four-ring row shown under each learner turn. */
export function ScoreRow({ scores, size = 34 }) {
  if (!scores) return null;
  const perfect = Number(scores.overall) >= 9;
  return (
    <div className="sn-scores">
      <ScoreRing label="GRM" value={scores.grammar} size={size} />
      <ScoreRing label="PRN" value={scores.pronunciation} size={size} />
      <ScoreRing label="FLU" value={scores.fluency} size={size} />
      <ScoreRing label="ALL" value={scores.overall} size={size + 6} perfect={perfect} />
    </div>
  );
}
