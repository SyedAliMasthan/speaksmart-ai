import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import AuthPage from "../pages/AuthPage";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import TermsOfService from "../pages/TermsOfService";
import ErrorBoundary from "../components/common/ErrorBoundary";
import {
  SCENARIOS,
  LANGUAGES,
  LEVELS,
  GOALS,
  PROFILE_DEFAULTS,
  scenarioById,
  recommendedScenario,
} from "../../shared/coach";
import { coach } from "./api";
import useConversation from "./useConversation";
import "./coach.css";

const paths = {
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5",
  wave: "M3 12c3-8 5 8 8 0s5 8 10 0",
  case: "M8 6V4h8v2M3 7h18v13H3zM3 12c6 3 12 3 18 0M12 12v4",
  people:
    "M16 21v-3c0-5-12-5-12 0v3M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4c5 0 5 7 0 7m2 4c2 1 2 3 2 6",
  globe:
    "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M2 12h20M12 2c-6 6-6 14 0 20m0-20c6 6 6 14 0 20",
  bolt: "m13 2-9 12h7l-1 8 10-13h-7z",
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3z",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  chart: "M4 3v18h17M8 16l4-5 4 2 5-8",
  repeat:
    "m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3",
  mic: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 4v6l4 2",
  sound: "m3 9 5 0 5-4v14l-5-4H3zM17 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  logout: "M9 3H3v18h6m-1-9h13m-5-5 5 5-5 5",
  book: "M12 5v16M3 3c4 0 6 1 9 3 3-2 5-3 9-3v15c-4 0-6 1-9 3-3-2-5-3-9-3z",
  close: "m6 6 12 12M6 18 18 6",
};
function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.wave} />
    </svg>
  );
}
function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-mark">
        <Icon name="wave" size={25} />
      </span>
      SpeakSmarts<span className="brand-ai">AI</span>
    </Link>
  );
}
function ButtonLink({ to, children, secondary = false }) {
  return (
    <Link to={to} className={`button ${secondary ? "secondary" : ""}`}>
      {children}
    </Link>
  );
}
function Notice({ children }) {
  return children ? (
    <div className="alert" role="alert">
      {children}
    </div>
  ) : null;
}
function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" /> Getting your workspace ready…
    </div>
  );
}
function Orb({ small = false, active = false }) {
  return (
    <div
      className={`orb-scene ${small ? "small" : ""} ${active ? "active" : ""}`}
      aria-hidden="true"
    >
      <div className="orb-orbit" />
      <div className="orb">
        <span className="orb-eye" />
        <span className="orb-eye" />
        <span className="orb-smile" />
      </div>
      <div className="orb-shadow" />
    </div>
  );
}
const LearningContext = createContext(null);
function useLearning() {
  return useContext(LearningContext);
}
function LearningProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const controller = useRef(null);
  async function refresh() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setError("");
    setLoading(true);
    try {
      const value = await coach("overview", {}, c.signal);
      if (!c.signal.aborted) setData(value);
    } catch (e) {
      if (!c.signal.aborted) setError(e.message);
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    return () => controller.current?.abort();
  }, []);
  return (
    <LearningContext.Provider value={{ ...data, loading, error, refresh }}>
      {children}
    </LearningContext.Provider>
  );
}
function Protected() {
  const { user, loading, error } = useAuth();
  if (loading) return <Loading />;
  if (error)
    return (
      <main className="account-card">
        <Notice>{error}</Notice>
      </main>
    );
  return user ? (
    <LearningProvider key={user.id}>
      <Shell />
    </LearningProvider>
  ) : (
    <Navigate to="/login" replace />
  );
}
function Shell({ demo = false }) {
  const { user, signOut } = useAuth();
  const [error, setError] = useState("");
  return (
    <div className="workspace">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">YOUR LEARNING SPACE</div>
        <nav aria-label="Main navigation">
          {[
            ["/dashboard", "home", "Overview"],
            ["/lessons", "grid", "Practice library"],
            ["/progress", "chart", "My progress"],
            ["/review", "repeat", "My corrections"],
          ].map(([to, icon, label]) => (
            <NavLink
              key={to}
              to={demo ? "/preview" : to}
              className={({ isActive }) =>
                isActive ? "nav-item selected" : "nav-item"
              }
            >
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="mini-spark">✦</span>
          <strong>Small steps. Real confidence.</strong>
          <p>A few minutes of practice can make speaking feel more familiar.</p>
        </div>
        <div className="sidebar-bottom">
          <Link className="nav-item" to={demo ? "/signup" : "/profile"}>
            <Icon name="settings" />
            Learning preferences
          </Link>
          {!demo && (
            <button
              className="nav-item"
              onClick={() => signOut().catch((e) => setError(e.message))}
            >
              <Icon name="logout" />
              Sign out
            </button>
          )}
          <div className="user">
            <span className="user-avatar">
              {(user?.user_metadata?.full_name || "L")[0].toUpperCase()}
            </span>
            <div>
              <strong>
                {demo
                  ? "Your learning space"
                  : user?.user_metadata?.full_name || "English learner"}
              </strong>
              <small>
                {demo ? "Interactive preview" : "Keep showing up for yourself"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <span>
            <span className="status-dot" /> A little more confident, every day
          </span>
          <Link className="top-link" to={demo ? "/signup" : "/profile"}>
            {demo ? "Create your account" : "Your personal English coach"}{" "}
            <Icon name="arrow" size={16} />
          </Link>
        </header>
        {demo && (
          <div className="preview-notice">
            Workspace preview · Illustrative content, not your learning data.{" "}
            <Link to="/signup">Start your own journey →</Link>
          </div>
        )}
        <main id="main" className="workspace-main">
          <Notice>{error}</Notice>
          {demo ? <Dashboard demo /> : <Outlet />}
        </main>
        <footer className="workspace-footer">
          <span>SpeakSmarts · Speak a little. Grow a little.</span>
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <nav>
          <a href="#how">How it works</a>
          <Link to="/preview">Explore the workspace</Link>
          <ButtonLink to="/login" secondary>
            Sign in
          </ButtonLink>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div>
            <span className="eyebrow">
              <span className="status-dot" /> YOUR VOICE. YOUR PACE.
            </span>
            <h1>
              A little practice.
              <br />
              <em>A lot more confidence.</em>
            </h1>
            <p>
              Meet Liya, your AI English coach. Talk about real life, find the
              words you need, and turn your mistakes into your next small win.
            </p>
            <div className="hero-actions">
              <ButtonLink to="/signup">
                Start your speaking journey <Icon name="arrow" />
              </ButtonLink>
              <Link className="text-link" to="/preview">
                Take a look around ↗
              </Link>
            </div>
            <div className="language-line">
              <span>English practice, with explanations in</span>
              <strong>Tamil · Hindi · Telugu · and more</strong>
            </div>
          </div>
          <div className="landing-art">
            <div className="floating-tag tag-one">
              <span className="status-dot" /> A space to speak freely
            </div>
            <Orb />
            <div className="speech-card">
              <span className="tiny-label">LIYA · YOUR AI COACH</span>
              <p>“Tell me about something that made you smile today.”</p>
              <div className="waveform">
                {Array.from({ length: 25 }, (_, i) => (
                  <i key={i} style={{ height: `${8 + ((i * 17) % 29)}px` }} />
                ))}
              </div>
            </div>
            <div className="floating-tag tag-two">
              <Icon name="check" /> Every conversation is a step forward
            </div>
          </div>
        </section>
        <section id="how" className="how">
          <div>
            <span className="eyebrow">LESS PRESSURE. MORE PRACTICE.</span>
            <h2>From “I know it” to “I can say it.”</h2>
          </div>
          <div className="how-grid">
            {[
              [
                "01",
                "Make it yours",
                "Choose your goal, level and the language you prefer for explanations.",
              ],
              [
                "02",
                "Have a real conversation",
                "Practise everyday situations, interviews and workplace updates.",
              ],
              [
                "03",
                "Build on every attempt",
                "Review clear corrections and bring better sentences into your next conversation.",
              ],
            ].map(([n, title, body]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>Progress begins with a conversation.</span>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </footer>
    </div>
  );
}
function Header({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
function ScenarioCard({ scenario, demo = false }) {
  return (
    <Link
      to={demo ? "/signup" : `/practice/${scenario.id}`}
      className="scenario-card"
    >
      <span className={`scenario-icon ${scenario.color}`}>
        <Icon name={scenario.icon} size={24} />
      </span>
      <span className="scenario-category">{scenario.category}</span>
      <h3>{scenario.title}</h3>
      <p>{scenario.description}</p>
      <div className="scenario-meta">
        <span>
          <Icon name="clock" size={14} />
          {scenario.minutes} min · {scenario.level}
        </span>
        <Icon name="arrow" size={18} />
      </div>
    </Link>
  );
}
function Dashboard({ demo = false }) {
  const live = useLearning();
  const { user } = useAuth();
  const data = demo
    ? { profile: PROFILE_DEFAULTS, sessions: [], loading: false }
    : live;
  if (data.loading) return <Loading />;
  if (data.error)
    return (
      <>
        <Notice>{data.error}</Notice>
        <button className="button" onClick={data.refresh}>
          Try again
        </button>
      </>
    );
  const sessions = data.sessions || [];
  const completed = sessions.filter((s) => s.status === "completed");
  const recommended = scenarioById(recommendedScenario(data.profile?.goal));
  const resume = sessions.find((s) => s.status === "active");
  const minutes = Math.round(
    completed.reduce((n, s) => n + s.duration_seconds, 0) / 60,
  );
  return (
    <>
      <Header
        eyebrow="A FRESH CHANCE TO GROW"
        title={`Let's find your voice${!demo && user?.user_metadata?.full_name ? ", " + user.user_metadata.full_name.split(" ")[0] : ""}.`}
        description="You don’t need perfect English to have a great conversation."
      />
      <div className="dashboard-grid">
        <div className="main-column">
          <section className="coach-hero">
            <div className="coach-hero-copy">
              <span className="pill">
                <span className="status-dot" /> YOUR DAILY SPEAKING MOMENT
              </span>
              <h2>
                A conversation today.
                <br />
                More confidence tomorrow.
              </h2>
              <p>
                Liya is ready when you are. Start with something familiar, and
                see where the conversation takes you.
              </p>
              <ButtonLink
                to={
                  demo
                    ? "/signup"
                    : !data.profile
                      ? "/onboarding"
                      : resume
                        ? `/session/${resume.id}`
                        : `/practice/${recommended.id}`
                }
              >
                {!data.profile && !demo
                  ? "Make your learning plan"
                  : resume
                    ? "Continue your conversation"
                    : "Let’s talk with Liya"}
                <Icon name="arrow" />
              </ButtonLink>
              <small>
                <Icon name="clock" size={14} /> Just{" "}
                {data.profile?.daily_minutes || 10} minutes for yourself
              </small>
            </div>
            <div className="hero-orb">
              <Orb small />
              <span className="orb-caption">
                Liya<span>Your AI speaking companion</span>
              </span>
            </div>
          </section>
          <div className="section-heading">
            <div>
              <span className="eyebrow">REAL LIFE, REHEARSED</span>
              <h2>What’s on your mind?</h2>
            </div>
            <Link to={demo ? "/signup" : "/lessons"}>
              Explore all <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="scenario-grid">
            {SCENARIOS.slice(1, 4).map((s) => (
              <ScenarioCard key={s.id} scenario={s} demo={demo} />
            ))}
          </div>
          <section className="recent-section">
            <div className="section-heading">
              <h2>Your recent conversations</h2>
              <Link to={demo ? "/signup" : "/progress"}>
                View history <Icon name="arrow" size={16} />
              </Link>
            </div>
            {completed.length ? (
              <SessionRows sessions={completed.slice(0, 3)} />
            ) : (
              <div className="empty-inline">
                <span className="scenario-icon mint">
                  <Icon name="book" />
                </span>
                <div>
                  <strong>Your story starts with one conversation.</strong>
                  <p>
                    Your saved reviews will appear here after your first
                    practice.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
        <aside className="right-column">
          <section className="panel">
            <div className="section-heading">
              <h3>Your practice rhythm</h3>
              <Icon name="sun" />
            </div>
            <div className="rhythm-number">
              {completed.length}
              <span>completed conversations</span>
            </div>
            <div className="mini-stats">
              <div>
                <strong>{minutes}</strong>
                <span>practice minutes</span>
              </div>
              <div>
                <strong>
                  {data.profile?.daily_minutes || 10}
                  <small> min</small>
                </strong>
                <span>your daily goal</span>
              </div>
            </div>
            <p className="muted small-text">
              Progress grows with practice. Start small and build a rhythm that
              fits your day.
            </p>
          </section>
          <section className="panel tip-panel">
            <span className="eyebrow">A LITTLE ENCOURAGEMENT</span>
            <div className="quote-mark">“</div>
            <h3>You don’t have to get every word right to be understood.</h3>
            <p>
              Focus on sharing one thought clearly. The next sentence will come.
            </p>
            <span className="tip-signature">
              A note from Liya <span>✦</span>
            </span>
          </section>
          <section className="language-panel">
            <Icon name="globe" />
            <div>
              <strong>Learn in a way that feels familiar</strong>
              <p>
                Explanations in{" "}
                {data.profile?.native_language || "your preferred language"}.
              </p>
              <Link to={demo ? "/signup" : "/profile"}>
                Adjust preferences →
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
function Preferences({ onboarding = false }) {
  const data = useLearning();
  const navigate = useNavigate();
  const [form, setForm] = useState(PROFILE_DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data.profile) setForm(data.profile);
  }, [data.profile]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await coach("profile", form);
      await data.refresh();
      if (onboarding) navigate("/dashboard");
      else setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (data.loading) return <Loading />;
  return (
    <>
      <Header
        eyebrow={onboarding ? "YOUR FIRST SMALL STEP" : "MAKE IT YOURS"}
        title={
          onboarding
            ? "A coach that starts with you."
            : "Your learning preferences"
        }
        description="Tell Liya what you want to work on. You can change these anytime."
      />
      <form className="preferences panel" onSubmit={save}>
        <Notice>{error || data.error}</Notice>
        {[
          ["native_language", "Explain things to me in", LANGUAGES],
          ["level", "Where I’m starting", LEVELS],
          ["goal", "What I’m working towards", GOALS],
        ].map(([key, label, options]) => (
          <fieldset key={key}>
            <legend>{label}</legend>
            <div className="option-grid">
              {options.map((option) => (
                <label
                  key={option}
                  className={`option ${form[key] === option ? "chosen" : ""}`}
                >
                  <input
                    type="radio"
                    name={key}
                    value={option}
                    checked={form[key] === option}
                    onChange={() => {
                      setForm({ ...form, [key]: option });
                      setSaved(false);
                    }}
                  />
                  <span>{option}</span>
                  {form[key] === option && <Icon name="check" size={16} />}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset>
          <legend>My daily practice goal</legend>
          <div className="option-grid">
            {[5, 10, 15].map((n) => (
              <label
                className={`option ${form.daily_minutes === n ? "chosen" : ""}`}
                key={n}
              >
                <input
                  type="radio"
                  name="minutes"
                  checked={form.daily_minutes === n}
                  onChange={() => {
                    setForm({ ...form, daily_minutes: n });
                    setSaved(false);
                  }}
                />
                {n} minutes
              </label>
            ))}
          </div>
        </fieldset>
        <p className="muted">
          Your selected level guides the conversation. It is not a proficiency
          test result.
        </p>
        <button className="button" disabled={busy}>
          {busy ? "Saving…" : onboarding ? "Let’s begin" : "Save preferences"}
          <Icon name="arrow" />
        </button>
        {saved && (
          <p role="status" className="success-text">
            Preferences saved.
          </p>
        )}
      </form>
    </>
  );
}
function Library() {
  const [category, setCategory] = useState("All");
  return (
    <>
      <Header
        eyebrow="REAL LIFE, REHEARSED"
        title="There’s a conversation for that."
        description="Pick a situation. Find your words. Make it your own."
      />
      <div className="filters" aria-label="Filter topics">
        {["All", "Everyday", "Career", "Workplace", "Travel"].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            className={category === c ? "selected" : ""}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="library-grid">
        {SCENARIOS.filter(
          (s) => category === "All" || s.category === category,
        ).map((s) => (
          <ScenarioCard key={s.id} scenario={s} />
        ))}
      </div>
    </>
  );
}
function StartPractice() {
  const { scenarioId: requested } = useParams();
  const scenarioId =
    {
      "introduce-yourself": "introductions",
      "job-interview": "interview",
      "free-conversation": "daily",
    }[requested] || requested;
  const scenario = scenarioById(scenarioId);
  const data = useLearning();
  const navigate = useNavigate();
  const sessionId = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!scenario) return <NotFound />;
  if (data.loading) return <Loading />;
  if (data.error)
    return (
      <>
        <Notice>{data.error}</Notice>
        <button className="button" onClick={data.refresh}>
          Try again
        </button>
      </>
    );
  if (!data.profile) return <Navigate to="/onboarding" replace />;
  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await coach("start", {
        sessionId: sessionId.current,
        scenarioId,
      });
      await data.refresh();
      navigate(`/session/${result.session.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="start-practice">
      <Link className="text-link" to="/lessons">
        ← Practice library
      </Link>
      <div className={`scenario-icon ${scenario.color}`}>
        <Icon name={scenario.icon} size={28} />
      </div>
      <span className="eyebrow">
        {scenario.category} · ABOUT {scenario.minutes} MINUTES
      </span>
      <h1>{scenario.title}</h1>
      <p>{scenario.description}</p>
      <Orb small />
      <div className="start-instructions panel">
        <h3>A comfortable space to practise</h3>
        <p>
          Speak using your microphone or type an answer. Liya responds in
          English and explains corrections in {data.profile.native_language}.
        </p>
        <p>
          Your transcript and feedback are saved to your account. Audio is sent
          to our speech provider for processing; this app does not store
          recordings.
        </p>
        <p>Pronunciation scoring is not included in this release.</p>
      </div>
      <Notice>{error}</Notice>
      <button
        className="button"
        disabled={busy || !data.capabilities?.chat}
        onClick={start}
      >
        {busy ? "Opening your conversation…" : "Start conversation"}
        <Icon name="arrow" />
      </button>
      {!data.capabilities?.chat && (
        <p role="status">
          The AI coach is temporarily unavailable. Please try again later.
        </p>
      )}
    </div>
  );
}
function Conversation() {
  const { sessionId } = useParams();
  const call = useConversation(sessionId);
  const learning = useLearning();
  const bottom = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [call.session?.revision]);
  useEffect(() => {
    if (call.state === "completed") {
      learning.refresh();
      navigate(`/session/${sessionId}/review`, { replace: true });
    }
  }, [call.state]);
  if (call.state === "loading") return <Loading />;
  if (!call.session)
    return (
      <>
        <Notice>{call.error}</Notice>
        <ButtonLink to="/dashboard">Back to overview</ButtonLink>
      </>
    );
  const scenario = scenarioById(call.session.scenario_id);
  const isBusy = ["thinking", "transcribing", "saving"].includes(call.state);
  const last = call.session.transcript.at(-1);
  const correction = call.session.transcript.filter((t) => t.correction).at(-1);
  return (
    <>
      <div className="conversation-heading">
        <Link to="/dashboard" className="text-link">
          ← Save & leave
        </Link>
        <span>
          <Icon name="clock" size={16} />
          {Math.floor(call.seconds / 60)}:
          {String(call.seconds % 60).padStart(2, "0")}
        </span>
        <button
          className="button secondary compact"
          onClick={call.complete}
          disabled={call.session.revision < 2 || call.state !== "ready"}
        >
          {call.state === "saving" ? "Preparing review…" : "Finish & review"}
        </button>
      </div>
      <div className="conversation-grid">
        <section className="speaking-room">
          <span className="eyebrow">{scenario?.title}</span>
          <h1>Your space to speak.</h1>
          <Orb active={["recording", "speaking"].includes(call.state)} />
          <div className="voice-status" aria-live="polite">
            <span
              className={`status-dot ${call.state === "recording" ? "recording" : ""}`}
            />
            {{
              ready: "Liya is ready for your next thought",
              recording: "Listening… tap stop when you’re ready",
              transcribing: "Finding your words…",
              thinking: "Liya is thinking…",
              speaking: "Liya is speaking…",
              saving: "Putting your review together…",
            }[call.state] || "Ready when you are"}
          </div>
          <blockquote>
            {last?.role === "assistant" ? last.content : "One moment…"}
          </blockquote>
          <Notice>{call.error}</Notice>
          <div className="voice-controls">
            {call.state === "speaking" ? (
              <button
                className="mic-button"
                onClick={call.stop}
                aria-label="Stop tutor audio"
              >
                <Icon name="close" size={28} />
              </button>
            ) : (
              <button
                className={`mic-button ${call.state === "recording" ? "listening" : ""}`}
                style={{ "--level": call.level }}
                disabled={isBusy || !learning.capabilities?.voice}
                onClick={call.listen}
                aria-label={
                  call.state === "recording"
                    ? "Stop recording"
                    : "Record your answer"
                }
              >
                {call.state === "recording" ? (
                  <span className="stop-square" />
                ) : (
                  <Icon name="mic" size={28} />
                )}
              </button>
            )}
            <span>
              {call.state === "recording" ? "Tap to stop" : "Tap to speak"}
            </span>
          </div>
          {!learning.capabilities?.voice && (
            <p className="muted">
              Voice is unavailable right now. You can still type your answer.
            </p>
          )}
          <form
            className="message-form"
            onSubmit={(e) => {
              e.preventDefault();
              call.send(call.draft);
            }}
          >
            <label className="sr-only" htmlFor="answer">
              Your answer
            </label>
            <textarea
              id="answer"
              rows={2}
              placeholder="Prefer to type? Your words belong here too…"
              maxLength={2000}
              value={call.draft}
              onChange={(e) => call.setDraft(e.target.value)}
              disabled={call.state !== "ready"}
            />
            <button
              className="send-button"
              aria-label="Send answer"
              disabled={!call.draft.trim() || call.state !== "ready"}
            >
              <Icon name="arrow" />
            </button>
          </form>
          <small className="muted">
            {call.session.revision}/40 answers ·{" "}
            {call.session.revision < 2
              ? "Two answers unlock your session review."
              : "Your conversation is saved as you go."}
          </small>
        </section>
        <aside className="conversation-aside">
          <section className="panel transcript-panel">
            <div className="section-heading">
              <h3>The conversation</h3>
              <span className="tiny-label">SAVED</span>
            </div>
            <div className="transcript">
              {call.session.transcript.map((turn, i) => (
                <div
                  className={`transcript-turn ${turn.role}`}
                  key={turn.turn_id ? `${turn.turn_id}-${turn.role}` : i}
                >
                  <span>{turn.role === "user" ? "YOU" : "LIYA"}</span>
                  <p>{turn.content}</p>
                  {turn.role === "assistant" &&
                    learning.capabilities?.voice && (
                      <button
                        className="text-link"
                        disabled={call.state !== "ready"}
                        onClick={() => call.repeat(turn.content)}
                      >
                        <Icon name="sound" size={14} /> Listen
                      </button>
                    )}
                </div>
              ))}
              <div ref={bottom} />
            </div>
          </section>
          {correction ? (
            <section className="panel correction-panel">
              <span className="eyebrow">A SMALL IMPROVEMENT</span>
              <p className="original">{correction.content}</p>
              <p className="corrected">{correction.correction.corrected}</p>
              <p>{correction.correction.explanation}</p>
            </section>
          ) : (
            <section className="panel">
              <span className="eyebrow">NO PRESSURE TO BE PERFECT</span>
              <p className="muted">
                Share one thought at a time. Useful corrections will appear here
                as you practise.
              </p>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
function SessionRows({ sessions }) {
  return (
    <div className="session-rows">
      {sessions.map((s) => (
        <Link
          className="session-row"
          to={`/session/${s.id}${s.status === "completed" ? "/review" : ""}`}
          key={s.id}
        >
          <span className="scenario-icon lavender">
            <Icon name={scenarioById(s.scenario_id)?.icon} />
          </span>
          <div>
            <strong>
              {scenarioById(s.scenario_id)?.title || "Conversation"}
            </strong>
            <small>
              {new Date(s.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}{" "}
              · {s.status === "completed" ? "Completed" : "Ready to continue"}
            </small>
          </div>
          <Icon name="arrow" />
        </Link>
      ))}
    </div>
  );
}
function Progress() {
  const data = useLearning();
  if (data.loading) return <Loading />;
  const complete = (data.sessions || []).filter(
    (s) => s.status === "completed",
  );
  return (
    <>
      <Header
        eyebrow="YOUR EFFORT ADDS UP"
        title="Every conversation counts."
        description="Review your recent practice and keep moving forward."
      />
      <Notice>{data.error}</Notice>
      <div className="progress-stats">
        <section className="panel">
          <strong>{complete.length}</strong>
          <span>completed conversations</span>
        </section>
        <section className="panel">
          <strong>
            {Math.round(
              complete.reduce((n, s) => n + s.duration_seconds, 0) / 60,
            )}
          </strong>
          <span>practice minutes</span>
        </section>
        <section className="panel">
          <strong>{new Set(complete.map((s) => s.scenario_id)).size}</strong>
          <span>topics explored</span>
        </section>
      </div>
      <p className="muted small-text">
        Based on your 60 most recent sessions. Practice time includes reading,
        listening and answering.
      </p>
      <section className="panel">
        <h2>Your conversations</h2>
        {data.sessions?.length ? (
          <SessionRows sessions={data.sessions} />
        ) : (
          <div className="empty-state">
            <Icon name="chart" size={35} />
            <h3>Your progress starts here.</h3>
            <p>Finish a conversation to save your first review.</p>
            <ButtonLink to="/lessons">
              Find a topic <Icon name="arrow" />
            </ButtonLink>
          </div>
        )}
      </section>
      {data.legacySessions?.length > 0 && (
        <details className="panel legacy-archive">
          <summary>Your earlier saved paragraphs</summary>
          {data.legacySessions.map((s) => (
            <article className="transcript-turn" key={s.id}>
              <span>{s.lesson_id.replaceAll("-", " ")}</span>
              <p>{s.summary}</p>
            </article>
          ))}
        </details>
      )}
    </>
  );
}
function Review() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    coach("session", { sessionId }, c.signal)
      .then((r) => setSession(r.session))
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [sessionId]);
  if (error) return <Notice>{error}</Notice>;
  if (!session) return <Loading />;
  if (session.status !== "completed")
    return <Navigate to={`/session/${sessionId}`} replace />;
  const report = session.report;
  return (
    <>
      <Header
        eyebrow="ONE CONVERSATION. ANOTHER STEP FORWARD."
        title="You showed up. That matters."
        description={scenarioById(session.scenario_id)?.title}
      >
        <ButtonLink to="/lessons">
          Practise again <Icon name="arrow" />
        </ButtonLink>
      </Header>
      <section className="review-summary panel">
        <span className="scenario-icon mint">
          <Icon name="check" size={28} />
        </span>
        <div>
          <h2>A note from Liya</h2>
          <p>{report.summary}</p>
        </div>
      </section>
      <div className="review-grid">
        <section className="panel">
          <span className="eyebrow">BUILD ON THESE</span>
          <h2>What went well</h2>
          <ul className="review-list">
            {report.strengths.map((s, i) => (
              <li key={i}>
                <Icon name="check" />
                {s}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <span className="eyebrow">YOUR NEXT SMALL STEPS</span>
          <h2>Try this next time</h2>
          <ul className="review-list">
            {report.next_steps.map((s, i) => (
              <li key={i}>
                <Icon name="arrow" />
                {s}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="section-heading">
        <h2>Sentences to take with you</h2>
        <span className="tiny-label">UP TO THREE USEFUL CORRECTIONS</span>
      </div>
      <div className="review-grid">
        {report.corrections.map((c, i) => (
          <Correction key={i} correction={c} />
        ))}
        {!report.corrections.length && (
          <p className="muted">
            No specific corrections were recorded in this session.
          </p>
        )}
      </div>
      <p className="evidence-note">
        {report.evidence} AI feedback can be imperfect; use it as guidance.
      </p>
      <details className="panel">
        <summary>Read your full conversation</summary>
        {session.transcript.map((t, i) => (
          <div className="transcript-turn" key={i}>
            <span>{t.role === "user" ? "YOU" : "LIYA"}</span>
            <p>{t.content}</p>
          </div>
        ))}
      </details>
    </>
  );
}
function Correction({ correction }) {
  return (
    <article className="panel correction-panel">
      <span className="tiny-label">{correction.category}</span>
      <p className="original">{correction.original}</p>
      <p className="corrected">{correction.corrected}</p>
      <p>{correction.explanation}</p>
      <span className="small-text muted">
        Try saying the improved sentence aloud, then make one of your own.
      </span>
    </article>
  );
}
function Corrections() {
  const data = useLearning();
  if (data.loading) return <Loading />;
  const items = (data.sessions || [])
    .filter((s) => s.report)
    .flatMap((s) => s.report.corrections || []);
  return (
    <>
      <Header
        eyebrow="MAKE THE NEXT ATTEMPT EASIER"
        title="Your personal phrase notebook."
        description="Useful corrections from your recent conversations, ready to revisit."
      />
      <Notice>{data.error}</Notice>
      {items.length ? (
        <div className="review-grid">
          {items.map((c, i) => (
            <Correction key={i} correction={c} />
          ))}
        </div>
      ) : (
        <section className="panel empty-state">
          <Icon name="repeat" size={36} />
          <h2>A place for your small wins.</h2>
          <p>
            Your corrections will appear here after a completed conversation.
          </p>
          <ButtonLink to="/lessons">
            Start practising <Icon name="arrow" />
          </ButtonLink>
        </section>
      )}
    </>
  );
}
function LegacyPractice() {
  const { topic, lessonId } = useParams();
  const mapping = {
    "introduce-yourself": "introductions",
    "job-interview": "interview",
    travel: "travel",
    "free-conversation": "daily",
  };
  return (
    <Navigate
      to={`/practice/${mapping[topic || lessonId] || "daily"}`}
      replace
    />
  );
}
function NotFound() {
  return (
    <div className="account-card">
      <Brand />
      <h1>Let’s get you back on track.</h1>
      <p>This page could not be found.</p>
      <ButtonLink to="/dashboard">Go to your workspace</ButtonLink>
    </div>
  );
}
export default function CoachApp() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/preview" element={<Shell demo />} />
            {["login", "signup"].map((mode) => (
              <Route
                key={mode}
                path={`/${mode}`}
                element={<AuthPage mode={mode} />}
              />
            ))}
            <Route
              path="/forgot-password"
              element={<AuthPage mode="forgot" />}
            />
            <Route path="/reset-password" element={<AuthPage mode="reset" />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route element={<Protected />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/onboarding" element={<Preferences onboarding />} />
              <Route path="/profile" element={<Preferences />} />
              <Route path="/lessons" element={<Library />} />
              <Route path="/practice/:scenarioId" element={<StartPractice />} />
              <Route path="/session/:sessionId" element={<Conversation />} />
              <Route path="/session/:sessionId/review" element={<Review />} />
              <Route path="/progress" element={<Progress />} />
              <Route path="/review" element={<Corrections />} />
              <Route
                path="/settings"
                element={<Navigate to="/profile" replace />}
              />
              <Route
                path="/call"
                element={<Navigate to="/practice/daily" replace />}
              />
              <Route
                path="/call/history"
                element={<Navigate to="/progress" replace />}
              />
              <Route path="/call/:lessonId" element={<LegacyPractice />} />
              <Route
                path="/practice"
                element={<Navigate to="/lessons" replace />}
              />
              <Route
                path="/chat"
                element={<Navigate to="/practice/daily" replace />}
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
