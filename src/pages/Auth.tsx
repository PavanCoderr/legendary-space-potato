import { useState, type ReactNode } from 'react';
import { ArrowRight, Atom, GraduationCap, Lock, Mail, Sparkles, UserRound } from 'lucide-react';
import { LESSONS } from '../data/lessons';
import type { LearningLevel } from '../data/types';
import { NAV_MAP, Link, navigate, type RouteName } from '../router';
import { useApp } from '../state/StoreProvider';
import { ThemeToggle } from '../components/ThemeToggle';
import { Badge, Card, Field } from '../components/ui';

const LEVELS: { level: LearningLevel; blurb: string }[] = [
  { level: 'Beginner', blurb: 'New to quantum computing — start from qubits and superposition.' },
  { level: 'Intermediate', blurb: 'Comfortable with the basics — go deeper into gates and entanglement.' },
  { level: 'Advanced', blurb: 'Ready for algorithms, oracles and interference-based speedups.' },
];

/** Split screen: the pitch on the left, the form on the right. */
function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Link to="#/home" className="brand">
          <span className="brand-mark">QV</span>
          <span className="brand-text">
            <strong>QubitVerse</strong>
            <span>Interactive quantum learning</span>
          </span>
        </Link>
        <div className="auth-aside-body">
          <h2>Learn Quantum. Build Quantum. Understand Quantum.</h2>
          <p className="muted">
            Your interactive journey into quantum computing: lessons, teaching videos, a circuit builder, a real
            state-vector simulator, an AI tutor that can see your circuit, and progress that tracks itself.
          </p>
          <ul className="list-plain">
            <li>{LESSONS.length} interactive modules from qubits to Grover's algorithm</li>
            <li>A simulator that samples real measurement shots</li>
            <li>Challenges validated against your actual quantum state</li>
          </ul>
        </div>
        <div className="auth-aside-foot">
          <div className="row between" style={{ marginBottom: 8 }}>
            <ThemeToggle />
            <span className="tiny dim" aria-hidden>
              QubitVerse
            </span>
          </div>
          <div className="tiny dim">
            Sessions are mocked in the browser for now — nothing is sent anywhere and no password is stored.
          </div>
        </div>
      </aside>

      <div className="auth-main">
        <Card title={title} subtitle={subtitle} className="auth-card">
          {children}
        </Card>
        <div className="center small" style={{ marginTop: 4 }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

function useAuthSubmit() {
  const { actions } = useApp();
  const [error, setError] = useState<string | null>(null);

  const validate = (email: string, password: string, name?: string) => {
    if (name !== undefined && name.trim().length < 2) return 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < 6) return 'Your password needs at least 6 characters.';
    return null;
  };

  const submit = (
    input: { email: string; password: string; name?: string; level: LearningLevel },
    target: RouteName,
  ) => {
    const problem = validate(input.email, input.password, input.name);
    if (problem) {
      setError(problem);
      return false;
    }
    setError(null);
    actions.signIn({ email: input.email, name: input.name, level: input.level, demo: false });
    navigate(target);
    return true;
  };

  return { error, submit };
}

const GOOGLE_NOTICE = 'google-not-connected';

export function LoginPage({ requested }: { requested?: RouteName }) {
  const { actions } = useApp();
  const [email, setEmail] = useState('alex@qubitverse.dev');
  const [password, setPassword] = useState('quantum');
  const [notice, setNotice] = useState<string | null>(null);
  const { error, submit } = useAuthSubmit();
  const target: RouteName = requested ?? 'dashboard';

  return (
    <AuthShell
      title="Welcome back"
      subtitle={requested ? `Sign in to continue to ${NAV_MAP[requested]?.label ?? requested}` : 'Continue your quantum journey'}
      footer={
        <>
          New here? <Link to="#/signup" className="link">Create an account</Link> ·{' '}
          <Link to="#/home" className="link">
            Back to the landing page
          </Link>
        </>
      }
    >
      <Field label="Email">
        <input
          type="email"
          value={email}
          autoComplete="username"
          placeholder="you@university.edu"
          onChange={event => setEmail(event.target.value)}
        />
      </Field>
      <Field label="Password" hint="Mocked authentication — any password of 6+ characters works.">
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          placeholder="••••••••"
          onChange={event => setPassword(event.target.value)}
        />
      </Field>

      {error && <p className="small" style={{ color: 'var(--bad-ink)' }}>{error}</p>}

      <button
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => submit({ email, password, level: 'Beginner' }, target)}
      >
        <Lock size={15} /> Continue
      </button>

      <button
        className="btn"
        style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
        onClick={() => setNotice(GOOGLE_NOTICE)}
      >
        <Mail size={15} aria-hidden /> Continue with Google
      </button>

      {notice === GOOGLE_NOTICE && (
        <p className="tiny dim" style={{ margin: '8px 0 0' }} role="status">
          Google sign-in is not connected in this build, so no account is created. Use the demo learner below,
          or continue with any email above — nothing is sent anywhere either way.
        </p>
      )}

      <button
        className="btn btn-ghost"
        style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
        onClick={() => {
          actions.signIn({ email: 'alex@qubitverse.dev', name: 'Alex Rivera', level: 'Beginner', demo: true });
          navigate(target);
        }}
      >
        <Sparkles size={15} /> Continue as the demo learner
      </button>

      <div className="callout" style={{ marginTop: 14 }}>
        <div className="row tight">
          <Badge tone="accent">
            <Atom size={12} aria-hidden /> Demo account
          </Badge>
          <span className="tiny dim">Pre-filled so you can get straight to the dashboard.</span>
        </div>
      </div>
    </AuthShell>
  );
}

export function SignupPage() {
  const [name, setName] = useState('Alex Rivera');
  const [email, setEmail] = useState('alex@qubitverse.dev');
  const [password, setPassword] = useState('quantum');
  const [level, setLevel] = useState<LearningLevel>('Beginner');
  const { error, submit } = useAuthSubmit();

  return (
    <AuthShell
      title="Create your account"
      subtitle="Tell us where you are starting from and the curriculum adapts"
      footer={
        <>
          Already learning here? <Link to="#/login" className="link">Sign in</Link> ·{' '}
          <Link to="#/home" className="link">
            Back to the landing page
          </Link>
        </>
      }
    >
      <Field label="Name">
        <input value={name} placeholder="Your name" onChange={event => setName(event.target.value)} />
      </Field>
      <Field label="Email">
        <input
          type="email"
          value={email}
          placeholder="you@university.edu"
          onChange={event => setEmail(event.target.value)}
        />
      </Field>
      <Field label="Password" hint="At least 6 characters. Stored nowhere — this is a mocked session.">
        <input
          type="password"
          value={password}
          placeholder="••••••••"
          onChange={event => setPassword(event.target.value)}
        />
      </Field>

      <div className="field-label">
        <UserRound size={13} aria-hidden /> Learning level
      </div>
      <div className="level-picker">
        {LEVELS.map(option => (
          <button
            key={option.level}
            className={`level-option${level === option.level ? ' active' : ''}`}
            onClick={() => setLevel(option.level)}
            aria-pressed={level === option.level}
          >
            <span className="row tight">
              <GraduationCap size={14} aria-hidden />
              <strong className="small">{option.level}</strong>
            </span>
            <span className="tiny muted">{option.blurb}</span>
          </button>
        ))}
      </div>

      {error && <p className="small" style={{ color: 'var(--bad-ink)' }}>{error}</p>}

      <button
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
        onClick={() => submit({ email, password, name, level }, 'dashboard')}
      >
        Create account and start learning <ArrowRight size={15} />
      </button>
      <p className="tiny dim" style={{ marginTop: 10, marginBottom: 0 }}>
        Your progress is stored on this device, so signing up keeps whatever you have already completed.
      </p>
    </AuthShell>
  );
}
