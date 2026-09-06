import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const FEATURES = [
  { icon: '🎤', title: 'Voice Practice', desc: 'Speak in Tamil, Hindi, Telugu or English — get instant AI corrections on grammar, pronunciation and fluency.', color: '#1B998B' },
  { icon: '🧠', title: 'Smart AI Tutor', desc: 'Powered by Groq AI for lightning-fast responses. Adapts to your level and learns your weak areas.', color: '#3B82F6' },
  { icon: '💼', title: 'Job Interview Prep', desc: 'Practice real interview scenarios — "Tell me about yourself", salary negotiation, HR rounds.', color: '#F97316' },
  { icon: '📚', title: 'Vocabulary Builder', desc: 'Flashcards with tap-to-flip. Learn words from your practice sessions — not random lists.', color: '#EAB308' },
  { icon: '🔥', title: 'Daily Streaks & Challenges', desc: 'Build a habit with streak tracking, daily challenges, and achievement badges.', color: '#DC2626' },
  { icon: '📊', title: 'Progress Analytics', desc: 'See your fluency score improve over time. Track mistakes fixed, sessions completed, words mastered.', color: '#8B5CF6' },
];

const TESTIMONIALS = [
  { name: 'Priya K.', role: 'Software Engineer, Chennai', text: 'I was always nervous speaking English in meetings. After 2 months with SpeakSmart, I led my first client presentation confidently.', avatar: '👩‍💻' },
  { name: 'Rajesh M.', role: 'Bank Officer, Hyderabad', text: 'The job interview practice helped me crack my dream banking role. The AI feels like talking to a real tutor.', avatar: '👨‍💼' },
  { name: 'Anjali S.', role: 'College Student, Coimbatore', text: 'Learning English through Tamil examples makes so much more sense. My vocabulary has tripled in 3 months.', avatar: '👩‍🎓' },
];

const STATS = [
  { value: '10K+', label: 'Active Learners' },
  { value: '500K+', label: 'Practice Sessions' },
  { value: '92%', label: 'Report Improvement' },
  { value: '4.8★', label: 'Average Rating' },
];

function useInView() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0, style = {} }) {
  const [ref, vis] = useInView();
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(28px)', transition: `all .7s cubic-bezier(.16,1,.3,1) ${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

export default function LandingPage() {
  const nav = useNavigate();
  const [demo, setDemo] = useState('');
  const full = 'I want to improve my English speaking for job interviews...';

  useEffect(() => {
    let i = 0;
    const t = setInterval(() => { if (i <= full.length) { setDemo(full.slice(0, i)); i++; } else clearInterval(t); }, 50);
    return () => clearInterval(t);
  }, []);

  const btn = (primary, text, onClick) => (
    <button onClick={onClick} style={{
      background: primary ? 'linear-gradient(135deg,#1B998B,#157A6E)' : 'transparent',
      border: primary ? 'none' : '1px solid #334155',
      color: primary ? '#fff' : '#cbd5e1',
      padding: primary ? '14px 32px' : '14px 28px',
      borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer',
      boxShadow: primary ? '0 4px 20px rgba(27,153,139,.35)' : 'none',
      transition: 'all .3s cubic-bezier(.16,1,.3,1)',
    }}>{text}</button>
  );

  return (
    <div style={{ background: '#0d0f14', color: '#f1f5f9', fontFamily: "'Plus Jakarta Sans',sans-serif", overflowX: 'hidden' }}>
      <a href="#main" className="skip-link">Skip to content</a>

      {/* NAV */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:50, background:'rgba(13,15,20,.88)', backdropFilter:'blur(16px)', borderBottom:'1px solid rgba(30,41,59,.5)' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:8, background:'linear-gradient(135deg,#1B998B,#157A6E)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>💬</div>
            <span style={{ fontSize:18, fontWeight:800 }}>Speak<span style={{ color:'#1B998B' }}>Smart</span></span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <button onClick={() => nav('/login')} style={{ background:'transparent', border:'1px solid #334155', color:'#94a3b8', padding:'8px 20px', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' }}>Sign In</button>
            <button onClick={() => nav('/signup')} style={{ background:'linear-gradient(135deg,#1B998B,#157A6E)', border:'none', color:'#fff', padding:'8px 20px', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer' }}>Start Free →</button>
          </div>
        </div>
      </nav>

      <main id="main">
        {/* HERO */}
        <section style={{ minHeight:'100vh', display:'flex', alignItems:'center', position:'relative', overflow:'hidden', paddingTop:80 }}>
          <div style={{ position:'absolute', top:'10%', left:'5%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(27,153,139,.12),transparent 70%)', filter:'blur(60px)', animation:'breathe 6s ease-in-out infinite' }} />
          <div style={{ position:'absolute', bottom:'10%', right:'5%', width:350, height:350, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,.08),transparent 70%)', filter:'blur(60px)', animation:'breathe 8s ease-in-out infinite 2s' }} />

          <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 24px', width:'100%' }}>
            <div style={{ maxWidth:720 }}>
              <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap', animation:'fadeUp .8s ease-out' }}>
                {[{n:'Tamil',t:'தமிழ்'},{n:'Hindi',t:'हिन्दी'},{n:'Telugu',t:'తెలుగు'}].map(l => (
                  <span key={l.n} style={{ background:'#1a1d28', border:'1px solid #1e293b', borderRadius:20, padding:'4px 14px', fontSize:13, color:'#94a3b8' }}>🇮🇳 {l.t}</span>
                ))}
              </div>

              <h1 style={{ fontSize:'clamp(36px,6vw,64px)', fontWeight:900, lineHeight:1.08, letterSpacing:'-.03em', marginBottom:20, animation:'fadeUp .8s ease-out .1s both' }}>
                Learn English by{' '}
                <span style={{ background:'linear-gradient(135deg,#1B998B,#2BC4B4)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>speaking</span>
                ,<br/>not memorizing.
              </h1>

              <p style={{ fontSize:'clamp(16px,2.5vw,20px)', color:'#94a3b8', lineHeight:1.6, maxWidth:560, marginBottom:32, animation:'fadeUp .8s ease-out .2s both' }}>
                AI-powered conversation practice in Tamil, Hindi & Telugu.
                Get instant corrections, build vocabulary, and nail your next
                job interview — <strong style={{ color:'#1B998B' }}>100% free, forever</strong>.
              </p>

              <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:24, animation:'fadeUp .8s ease-out .3s both' }}>
                {btn(true, 'Start Learning Free 🎓', () => nav('/signup'))}
                {btn(false, 'See How It Works ↓', () => document.getElementById('how')?.scrollIntoView({ behavior:'smooth' }))}
              </div>
              <p style={{ fontSize:13, color:'#475569', animation:'fadeUp .8s ease-out .4s both' }}>
                Free forever · No credit card · No ads · Works on all browsers
              </p>
            </div>

            {/* Demo card */}
            <div style={{ marginTop:60, maxWidth:500, background:'#161923', borderRadius:16, border:'1px solid #1e293b', overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,.4)', animation:'fadeUp .8s ease-out .5s both' }}>
              <div style={{ padding:'12px 16px', background:'#1a1d28', borderBottom:'1px solid #1e293b', display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#DC2626' }} />
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#EAB308' }} />
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#16A34A' }} />
                <span style={{ marginLeft:8, fontSize:12, color:'#475569' }}>Practice — Job Interview</span>
              </div>
              <div style={{ padding:20 }}>
                <div style={{ background:'#1e2330', borderRadius:12, padding:'12px 16px', marginBottom:12, maxWidth:'80%' }}>
                  <p style={{ fontSize:14, color:'#94a3b8', marginBottom:4 }}>AI Tutor</p>
                  <p style={{ fontSize:15, lineHeight:1.5 }}>Tell me about yourself and why you're interested in this role.</p>
                </div>
                <div style={{ background:'rgba(27,153,139,.12)', borderRadius:12, padding:'12px 16px', marginLeft:'auto', maxWidth:'85%', border:'1px solid rgba(27,153,139,.2)' }}>
                  <p style={{ fontSize:14, color:'#1B998B', marginBottom:4 }}>You</p>
                  <p style={{ fontSize:15, lineHeight:1.5 }}>{demo}<span style={{ opacity:.5, animation:'breathe 1s ease-in-out infinite' }}>|</span></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <Reveal>
          <section style={{ borderTop:'1px solid #1e293b', borderBottom:'1px solid #1e293b', padding:'40px 24px' }}>
            <div style={{ maxWidth:1000, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:32, textAlign:'center' }}>
              {STATS.map(s => (
                <div key={s.label}>
                  <div style={{ fontSize:32, fontWeight:900, color:'#1B998B' }}>{s.value}</div>
                  <div style={{ fontSize:14, color:'#64748b', marginTop:4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* FEATURES */}
        <section style={{ padding:'80px 24px' }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            <Reveal><div style={{ textAlign:'center', marginBottom:56 }}>
              <h2 style={{ fontSize:'clamp(28px,4vw,40px)', fontWeight:800 }}>Everything you need to <span style={{ color:'#1B998B' }}>speak confidently</span></h2>
              <p style={{ color:'#64748b', fontSize:17, marginTop:12, maxWidth:600, margin:'12px auto 0' }}>Built for Indian learners. Powered by AI. All features free — no premium wall.</p>
            </div></Reveal>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:20 }}>
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={i * 80}>
                  <div style={{ background:'#161923', borderRadius:16, border:'1px solid #1e293b', padding:28, height:'100%', transition:'all .3s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + '44'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.transform = 'none'; }}>
                    <div style={{ fontSize:32, marginBottom:16, width:56, height:56, borderRadius:14, background:f.color+'15', display:'flex', alignItems:'center', justifyContent:'center' }}>{f.icon}</div>
                    <h3 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>{f.title}</h3>
                    <p style={{ fontSize:15, color:'#94a3b8', lineHeight:1.6 }}>{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" style={{ padding:'80px 24px', background:'#0a0c10' }}>
          <div style={{ maxWidth:800, margin:'0 auto' }}>
            <Reveal><h2 style={{ fontSize:'clamp(28px,4vw,40px)', fontWeight:800, textAlign:'center', marginBottom:56 }}>Start speaking in <span style={{ color:'#1B998B' }}>3 minutes</span></h2></Reveal>
            {[
              { s:'01', t:'Sign up free', d:'Create your account with Google or email. Choose your native language and English level.', c:'#1B998B' },
              { s:'02', t:'Pick a scenario', d:'Job interview, restaurant ordering, daily conversation, or free talk — pick what matters to you.', c:'#3B82F6' },
              { s:'03', t:'Speak & improve', d:'Talk to the AI tutor using voice or text. Get instant corrections, score your fluency, watch your graph climb.', c:'#F97316' },
            ].map((item, i) => (
              <Reveal key={item.s} delay={i * 120}>
                <div style={{ display:'flex', gap:24, alignItems:'flex-start', marginBottom:40, padding:24, borderRadius:16, background:'#161923', border:'1px solid #1e293b' }}>
                  <div style={{ fontSize:28, fontWeight:900, color:item.c, minWidth:56, height:56, borderRadius:14, background:item.c+'12', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Mono,monospace' }}>{item.s}</div>
                  <div>
                    <h3 style={{ fontSize:20, fontWeight:700, marginBottom:6 }}>{item.t}</h3>
                    <p style={{ fontSize:15, color:'#94a3b8', lineHeight:1.6 }}>{item.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section style={{ padding:'80px 24px' }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            <Reveal><h2 style={{ fontSize:'clamp(28px,4vw,40px)', fontWeight:800, textAlign:'center', marginBottom:48 }}>Loved by learners across India</h2></Reveal>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:20 }}>
              {TESTIMONIALS.map((t, i) => (
                <Reveal key={t.name} delay={i * 100}>
                  <div style={{ background:'#161923', borderRadius:16, border:'1px solid #1e293b', padding:28, height:'100%' }}>
                    <div style={{ display:'flex', gap:4, marginBottom:16 }}>{[...Array(5)].map((_, j) => <span key={j} style={{ fontSize:16, color:'#EAB308' }}>★</span>)}</div>
                    <p style={{ fontSize:15, lineHeight:1.7, color:'#cbd5e1', marginBottom:20 }}>"{t.text}"</p>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'#1e2330', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{t.avatar}</div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700 }}>{t.name}</div>
                        <div style={{ fontSize:13, color:'#64748b' }}>{t.role}</div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* WHY FREE */}
        <Reveal>
          <section style={{ padding:'80px 24px', background:'#0a0c10' }}>
            <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center' }}>
              <h2 style={{ fontSize:'clamp(28px,4vw,36px)', fontWeight:800, marginBottom:20 }}>Why is SpeakSmart <span style={{ color:'#1B998B' }}>completely free</span>?</h2>
              <p style={{ color:'#94a3b8', fontSize:17, lineHeight:1.8, maxWidth:600, margin:'0 auto' }}>
                We believe every Indian deserves access to world-class English practice without paying for expensive tutors or courses. SpeakSmart is built as a passion project to bridge the communication gap — no ads, no premium walls, no hidden costs. Just practice and get better.
              </p>
            </div>
          </section>
        </Reveal>

        {/* FINAL CTA */}
        <section style={{ padding:'100px 24px' }}>
          <Reveal>
            <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center', background:'linear-gradient(135deg,rgba(27,153,139,.08),rgba(59,130,246,.05))', borderRadius:24, border:'1px solid rgba(27,153,139,.2)', padding:'56px 32px' }}>
              <h2 style={{ fontSize:'clamp(24px,4vw,36px)', fontWeight:800, marginBottom:16 }}>Your English journey starts now</h2>
              <p style={{ color:'#94a3b8', fontSize:17, marginBottom:32, maxWidth:500, margin:'0 auto 32px' }}>
                Join thousands of Tamil, Hindi, and Telugu speakers speaking English confidently — with AI that understands your language.
              </p>
              {btn(true, 'Start Learning Free 🎓', () => nav('/signup'))}
              <p style={{ fontSize:13, color:'#475569', marginTop:14 }}>Free forever · No credit card · No ads · 30-second signup</p>
            </div>
          </Reveal>
        </section>
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop:'1px solid #1e293b', padding:'40px 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
          <div>
            <span style={{ fontSize:16, fontWeight:800 }}>Speak<span style={{ color:'#1B998B' }}>Smart</span> AI</span>
            <p style={{ fontSize:13, color:'#475569', marginTop:4 }}>Built by Vahi · Powered by Groq AI · 100% Free</p>
          </div>
          <div style={{ display:'flex', gap:24 }}>
            <a href="/privacy" style={{ fontSize:14, color:'#64748b' }}>Privacy</a>
            <a href="/terms" style={{ fontSize:14, color:'#64748b' }}>Terms</a>
            <a href="mailto:hello@speaksmarts.in" style={{ fontSize:14, color:'#64748b' }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
