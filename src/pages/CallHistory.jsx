/**
 * Call history with running averages — SpeakNova's AI Call tab, rebuilt.
 * This is the screen that makes a learner come back: visible progress.
 *
 * Route: /call/history
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ScoreRing from '../components/ScoreRing';
import { supabase } from '../config/supabase';

const average = (rows, key) => {
  const values = rows.map((r) => r[key]).filter((v) => Number.isFinite(v));
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
};

function relativeDate(iso) {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function CallHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('session_analyses')
        .select('id, overall, grammar, pronunciation, fluency, vocabulary, topic_relevance, feedback, created_at')
        .order('created_at', { ascending: false })
        .limit(60);

      if (cancelled) return;
      if (err) setError('Could not load your calls.');
      else setRows(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const summary = useMemo(() => ({
    total: rows.length,
    overall: average(rows, 'overall'),
    grammar: average(rows, 'grammar'),
    pronunciation: average(rows, 'pronunciation'),
    fluency: average(rows, 'fluency'),
    vocabulary: average(rows, 'vocabulary'),
  }), [rows]);

  // Is the learner actually improving? Compare the five newest against the five oldest.
  const trend = useMemo(() => {
    if (rows.length < 6) return null;
    const recent = average(rows.slice(0, 5), 'overall');
    const earlier = average(rows.slice(-5), 'overall');
    if (recent == null || earlier == null) return null;
    return Math.round((recent - earlier) * 10) / 10;
  }, [rows]);

  return (
    <div className="sn-app">
      <span className="sn-orb sn-orb-1" aria-hidden="true" />
      <span className="sn-orb sn-orb-2" aria-hidden="true" />

      <header style={{ paddingBlock: 20, zIndex: 1 }}>
        <span className="sn-label">Your speaking</span>
        <h1 className="sn-h1 sn-gradient-text" style={{ marginTop: 6 }}>Progress</h1>
      </header>

      <main className="sn-stack" style={{ zIndex: 1, paddingBottom: 40 }}>
        {loading && <div className="sn-empty">Loading…</div>}
        {error && <div className="sn-alert">{error}</div>}

        {!loading && !error && summary.total > 0 && (
          <section className="sn-card" style={{ textAlign: 'center' }}>
            <span className="sn-label">
              Across {summary.total} call{summary.total === 1 ? '' : 's'}
            </span>
            <div style={{ display: 'grid', placeItems: 'center', marginBlock: 14 }}>
              <ScoreRing label="ALL" value={summary.overall} size={86}
                         perfect={summary.overall >= 9} />
            </div>

            {trend !== null && (
              <p style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 14,
                          color: trend > 0 ? 'var(--green)' : trend < 0 ? 'var(--amber)' : 'var(--faint)' }}>
                {trend > 0 ? `▲ up ${trend} since you started`
                  : trend < 0 ? `▼ down ${Math.abs(trend)} recently`
                  : 'Holding steady'}
              </p>
            )}

            <div className="sn-scores">
              <ScoreRing label="GRM" value={summary.grammar} size={44} />
              <ScoreRing label="PRN" value={summary.pronunciation} size={44} />
              <ScoreRing label="FLU" value={summary.fluency} size={44} />
              <ScoreRing label="VOC" value={summary.vocabulary} size={44} />
            </div>
          </section>
        )}

        {!loading && !error && summary.total === 0 && (
          <div className="sn-card sn-empty">
            No calls yet. Your scores appear here after your first conversation.
          </div>
        )}

        {rows.length > 0 && (
          <section>
            <span className="sn-label" style={{ paddingLeft: 4 }}>Past calls</span>
            <div className="sn-stack" style={{ marginTop: 10 }}>
              {rows.map((row) => (
                <Link key={row.id} to={`/call/analysis/${row.id}`} className="sn-row">
                  <span className="sn-badge"
                        style={row.overall >= 9
                          ? { background: 'rgba(46,232,165,0.14)', color: 'var(--green)' }
                          : undefined}>
                    {row.overall ?? '–'}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5 }}>
                      {relativeDate(row.created_at)}
                    </span>
                    {row.feedback && <span className="sn-clamp2">{row.feedback}</span>}
                  </span>
                  <span style={{ color: 'var(--faint)' }}>›</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <Link to="/call" className="sn-btn" style={{ textAlign: 'center', textDecoration: 'none' }}>
          Start a call
        </Link>
      </main>
    </div>
  );
}
