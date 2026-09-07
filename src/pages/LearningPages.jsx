import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../config/supabase';
import { LESSONS } from '../../shared/lessons';
export default function LearningPages({ page }) {
  const { user, signOut } = useAuth();
  const [sessions, setSessions] = useState([]); const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user.user_metadata?.full_name || '');
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(localStorage.getItem('speaksmart_voice') || 'ai');
  useEffect(() => {
    let alive = true; setError(''); setMessage('');
    if (page === 'dashboard') {
      setLoading(true);
      supabase.from('practice_sessions').select('id,lesson_id,summary,created_at').eq('user_id', user.id).eq('completed', true).order('created_at', { ascending: false }).limit(30)
        .then(({ data, error }) => { if (alive) { setSessions(data || []); setError(error ? 'Unable to load your saved practice. Please try again later.' : ''); setLoading(false); } });
    }
    return () => { alive = false; };
  }, [page, user.id]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      if (error) throw error;
      localStorage.setItem('speaksmart_voice', voice); setMessage('Preferences saved.');
    } catch { setError('Unable to save your preferences. Please try again.'); }
    finally { setBusy(false); }
  }
  return <div className="learning-shell"><header className="app-nav"><Link to="/dashboard" className="brand-link">SpeakSmart AI</Link><nav><Link to="/dashboard">My practice</Link><Link to="/lessons">Lessons</Link><Link to="/profile">Profile</Link><a href="https://finance.speaksmarts.in" rel="noreferrer">SpendWise</a><button onClick={()=>signOut().catch(e=>setError(e.message))}>Sign out</button></nav></header>
    <main className="learning-main">{error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
      {page === 'profile' ? <><h1>Your profile</h1><p className="muted">{user.email}</p><form onSubmit={save} className="profile-form"><label>Your name<input value={name} onChange={e=>setName(e.target.value)} maxLength={80} required /></label><label>Reading voice<select value={voice} onChange={e=>setVoice(e.target.value)}><option value="ai">AI voice with browser fallback</option><option value="browser">Browser voice</option></select></label><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button></form><p><Link to="/forgot-password">Change your password by email</Link></p></> : <>
        <h1>{page === 'lessons' ? 'What would you like to practise?' : `Welcome${user.user_metadata?.full_name ? ', ' + user.user_metadata.full_name : ''}`}</h1><p className="muted">Choose a topic, answer a few questions, and build a paragraph you can practise aloud.</p>
        <div className="lesson-grid">{Object.values(LESSONS).map(lesson=><Link className="lesson-card" key={lesson.id} to={`/practice/${lesson.id}`}><span aria-hidden="true">{lesson.icon}</span><h2>{lesson.title}</h2><p>{lesson.subtitle}</p><strong>Start practice →</strong></Link>)}</div>
        {page === 'dashboard' && <section><h2>Your saved paragraphs</h2>{loading ? <p role="status">Loading your practice…</p> : !sessions.length ? <p className="muted">Complete a lesson to save your first paragraph here.</p> : sessions.map(item=><article className="saved-practice" key={item.id}><h3>{LESSONS[item.lesson_id]?.title || 'English practice'}</h3><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time><p>{item.summary}</p></article>)}</section>}
      </>}
    </main><footer className="app-footer"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></footer>
  </div>;
}
