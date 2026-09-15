/**
 * Post-call analysis — SpeakNova's strongest retention hook, plus the per-sentence
 * detail they don't have.
 *
 * Route: /call/analysis/:id
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ScoreRing, { ScoreRow } from '../components/ScoreRing';
import { supabase } from '../config/supabase';

function useAnalysis(id) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // RLS scopes this to the signed-in user — no user_id filter needed client-side.
      const { data: row, error: err } = await supabase
        .from('session_analyses')
        .select('*, practice_sessions(lesson_id, transcript, duration_seconds, created_at)')
        .eq('id', id)
        .single();

      if (cancelled) return;
      if (err) setError('That call could not be found.');
      else setData(row);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  return { data, error, loading };
}

export default function CallAnalysis() {
  const { id } = useParams();
  const { data, error, loading } = useAnalysis(id);

  if (loading) {
    return (
      <div className="sn-app">
        <div className="sn-empty">Loading your call…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="sn-app">
        <div className="sn-empty">{error || 'Nothing here.'}</div>
        <Link to="/dashboard" className="sn-btn" style={{ textAlign: 'center', textDecoration: 'none' }}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  const session = data.practice_sessions || {};
  const transcript = Array.isArray(session.transcript) ? session.transcript : [];
  const minutes = Math.round((session.duration_seconds || 0) / 60);
  const learnerTurns = transcript.filter((t) => t.role === 'user');

  return (
    <div className="sn-app">
      <span className="sn-orb sn-orb-1" aria-hidden="true" />
      <span className="sn-orb sn-orb-2" aria-hidden="true" />

      <header style={{ paddingBlock: 20, zIndex: 1 }}>
        <span className="sn-label">Call review</span>
        <h1 className="sn-h1 sn-gradient-text" style={{ marginTop: 6 }}>
          {data.overall >= 9 ? 'Excellent work' : data.overall >= 7 ? 'Nicely done' : 'Good effort'}
        </h1>
        <p className="sn-muted" style={{ marginTop: 6 }}>
          {learnerTurns.length} sentence{learnerTurns.length === 1 ? '' : 's'}
          {minutes > 0 ? ` · ${minutes} min` : ''}
          {session.lesson_id ? ` · ${session.lesson_id.replace(/-/g, ' ')}` : ''}
        </p>
      </header>

      <main className="sn-stack" style={{ zIndex: 1, paddingBottom: 40 }}>
        <section className="sn-card" style={{ textAlign: 'center' }}>
          <span className="sn-label">Overall</span>
          <div style={{ display: 'grid', placeItems: 'center', marginBlock: 14 }}>
            <ScoreRing label="ALL" value={data.overall} size={92} perfect={data.overall >= 9} />
          </div>
          <div className="sn-scores">
            <ScoreRing label="GRM" value={data.grammar} size={46} />
            <ScoreRing label="PRN" value={data.pronunciation} size={46} />
            <ScoreRing label="FLU" value={data.fluency} size={46} />
            <ScoreRing label="VOC" value={data.vocabulary} size={46} />
            <ScoreRing label="TOP" value={data.topic_relevance} size={46} />
          </div>
        </section>

        {data.feedback && (
          <section className="sn-card">
            <span className="sn-label">What Liya noticed</span>
            <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.65, color: 'var(--muted)' }}>
              {data.feedback}
            </p>
          </section>
        )}

        <section>
          <span className="sn-label" style={{ paddingLeft: 4 }}>Sentence by sentence</span>
          <div className="sn-stack" style={{ marginTop: 10 }}>
            {learnerTurns.map((turn, i) => (
              <article key={i} className="sn-card">
                <p style={{ fontSize: 15, lineHeight: 1.6 }}>
                  {turn.correction?.corrected ? (
                    <>
                      <span className="sn-wrong">{turn.content}</span><br />
                      <span className="sn-right">{turn.correction.corrected}</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--ink)' }}>{turn.content}</span>
                  )}
                </p>

                {turn.scores && (
                  <div style={{ marginTop: 12 }}>
                    <ScoreRow scores={turn.scores} size={30} />
                  </div>
                )}

                {turn.correction?.rule && <div className="sn-rule">{turn.correction.rule}</div>}
                {Array.isArray(turn.correction?.examples) && turn.correction.examples.length > 0 && (
                  <ul className="sn-examples">
                    {turn.correction.examples.slice(0, 3).map((ex, k) => <li key={k}>{ex}</li>)}
                  </ul>
                )}
              </article>
            ))}
            {learnerTurns.length === 0 && (
              <div className="sn-empty">No sentences were recorded for this call.</div>
            )}
          </div>
        </section>

        <div className="sn-stack">
          <Link to="/call" className="sn-btn" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Practise again
          </Link>
          <Link to="/call/history" className="sn-btn sn-btn-ghost"
                style={{ textAlign: 'center', textDecoration: 'none' }}>
            See all my calls
          </Link>
        </div>
      </main>
    </div>
  );
}
