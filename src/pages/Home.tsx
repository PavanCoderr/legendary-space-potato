import { useEffect, useState } from 'react';
import { ArrowRight, Atom, CirclePlay } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import { CHALLENGES } from '../data/challenges';
import { LESSONS } from '../data/lessons';
import { QUIZZES } from '../data/quizzes';
import { LESSON_STAGES } from '../data/stages';
import { SITE } from '../data/site';
import { topicColor } from '../data/topics';
import { blochFromAngles } from '../quantum/bloch';
import { Link, navigate, route } from '../router';
import { useApp } from '../state/StoreProvider';
import { gateReference } from '../services/gateReference';
import { BlochSphere } from '../components/BlochSphere';
import { ThemeToggle } from '../components/ThemeToggle';
import { Badge, Card, SectionLabel } from '../components/ui';

/**
 * Static hero circuit: H on q0, then CNOT(q0 → q1), then measure both — the Bell-state
 * circuit. It is the same circuit the probability panel and the Bloch sphere beside it
 * describe, so the hero is honest rather than decorative.
 */
function HeroCircuit() {
  const lanes: { label: string; cells: string[] }[] = [
    { label: 'q0', cells: ['H', 'ctrl', 'M'] },
    { label: 'q1', cells: ['', 'target', 'M'] },
  ];
  return (
    <div className="hero-circuit" aria-label="Circuit diagram: H on qubit 0, CNOT with control qubit 0 and target qubit 1, then measurement">
      {lanes.map(lane => (
        <div className="hero-lane" key={lane.label}>
          <span className="hero-wire-label mono">{lane.label}</span>
          <div className="hero-track">
            {lane.cells.map((cell, index) => (
              <div className={`hero-cell${cell ? ` ${cell}` : ''}`} key={`${lane.label}-${index}`}>
                {cell === 'ctrl' && <span className="control-dot" aria-hidden />}
                {cell === 'target' && <span className="target-circle mono">⊕</span>}
                {cell && cell !== 'ctrl' && cell !== 'target' && <span className="gate-box mono">{cell}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="tiny dim" style={{ marginTop: 2 }}>
        H puts q0 in superposition, CNOT entangles q1 with it (control q0 → target q1), then both are measured.
      </div>
    </div>
  );
}

/** Probability panel matching the hero circuit: only |00⟩ and |11⟩, 50% each. */
function HeroProbabilities() {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const handle = window.setTimeout(() => setAnimate(true), 220);
    return () => window.clearTimeout(handle);
  }, []);
  const buckets = [
    { label: '|00⟩', value: 50 },
    { label: '|11⟩', value: 50 },
  ];
  return (
    <div className="hero-probs">
      <div className="row between tiny">
        <span className="muted">Probability</span>
        <span className="dim">1000 shots</span>
      </div>
      {buckets.map(bucket => (
        <div className="bar-row" key={bucket.label}>
          <span className="mono">{bucket.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: animate ? `${bucket.value}%` : '0%' }} />
          </span>
          <span className="mono tiny right">{bucket.value}%</span>
        </div>
      ))}
      <div className="tiny dim">States |01⟩ and |10⟩ have probability 0 — the qubits are entangled.</div>
    </div>
  );
}

/** The Bloch sphere with a vector precessing around the equator, standing in for |+⟩. */
function HeroBloch() {
  const [phi, setPhi] = useState(0);
  useEffect(() => {
    let frame = 0;
    const handle = window.setInterval(() => {
      frame += 1;
      setPhi((frame * Math.PI) / 90);
    }, 60);
    return () => window.clearInterval(handle);
  }, []);
  return (
    <div className="hero-bloch">
      <BlochSphere vector={blochFromAngles(Math.PI / 2, phi, 1)} size={210} showGhost={false} />
      <div className="tiny dim center">q0 after H — a vector on the equator</div>
    </div>
  );
}

/** The gates, read straight from the table the simulator multiplies into the state vector. */
function GateLibrary() {
  return (
    <div className="grid cols-4 gate-ref-grid">
      {gateReference().map(entry => (
        <article className="gate-ref" key={entry.type}>
          <div className="row tight">
            {/* colour is a var() token, so compose the tinted border with color-mix
                instead of hex concatenation (which would produce "var(--gate-h)55"). */}
            <span
              className="gate-ref-label mono"
              style={{
                color: entry.color,
                borderColor: `color-mix(in srgb, ${entry.color} 45%, transparent)`,
              }}
            >
              {entry.label}
            </span>
            <strong className="small">{entry.name}</strong>
          </div>
          {entry.matrix ? (
            <div
              className="gate-matrix"
              aria-label={`Matrix for ${entry.name}: ${entry.matrix.map(row => row.join(', ')).join('; ')}`}
            >
              {entry.matrix.map((row, rowIndex) => (
                <div className="gate-matrix-row" key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <span className="mono" key={cellIndex}>
                      {cell}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="tiny muted gate-ref-note">{entry.note}</p>
          )}
          <p className="tiny muted" style={{ margin: 0 }}>
            {entry.description}
          </p>
        </article>
      ))}
    </div>
  );
}

export function HomePage() {
  const { state } = useApp();
  const signedIn = state.session.signedIn;
  const start = () => navigate(signedIn ? 'dashboard' : 'signup');

  // Everything in the hero is counted from the data files, so the numbers cannot go stale.
  const namedLessons = LESSONS.reduce((sum, lesson) => sum + lesson.outline.length, 0);
  const practiceItems = QUIZZES.length + CHALLENGES.length;
  const gates = gateReference().length;
  const stats = [
    { value: LESSONS.length, label: 'modules' },
    { value: namedLessons, label: 'named lessons' },
    { value: gates, label: 'gates in the builder' },
    { value: practiceItems, label: 'quiz and challenge items' },
  ];

  return (
    <div className="landing">
      <header className="landing-nav">
        <Link to="#/home" className="brand">
          <span className="brand-mark">QV</span>
          <span className="brand-text">
            <strong>QubitVerse</strong>
            <span>Learn Quantum. Build Quantum. Understand Quantum.</span>
          </span>
        </Link>
        <nav className="landing-links">
          <Link to="#/learn" className="landing-link">
            Curriculum
          </Link>
          <Link to="#/builder" className="landing-link">
            Circuit builder
          </Link>
          <Link to="#/simulator" className="landing-link">
            Simulator
          </Link>
          <Link to="#/tutor" className="landing-link">
            AI tutor
          </Link>
        </nav>
        <div className="row tight">
          <ThemeToggle compact />
          {signedIn ? (
            <button className="btn-primary" onClick={start}>
              Open the app <ArrowRight size={15} aria-hidden />
            </button>
          ) : (
            <>
              <Link to="#/login" className="btn">
                Sign in
              </Link>
              <button className="btn-primary" onClick={() => navigate('signup')}>
                Get started
              </button>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <Badge tone="accent">
            <Atom size={13} aria-hidden /> Your interactive journey into quantum computing
          </Badge>
          <h1 className="hero-title">Quantum Computing, Made Interactive.</h1>
          <p className="hero-sub">
            Learn quantum computing through interactive lessons, videos, circuit building, simulations,
            visualizations and AI-powered guidance.
          </p>
          <div className="row tight" style={{ marginTop: 18 }}>
            <button className="btn-primary" onClick={start}>
              Start Learning <ArrowRight size={15} aria-hidden />
            </button>
            <button className="btn" onClick={() => navigate('simulator')}>
              <CirclePlay size={15} aria-hidden /> Explore Quantum Lab
            </button>
          </div>
          <dl className="hero-stats">
            {stats.map(stat => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="hero-visual">
          <div className="glass hero-panel">
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="mono small">Bell state circuit</span>
              <Badge tone="good">H + CNOT</Badge>
            </div>
            <HeroCircuit />
            <HeroProbabilities />
          </div>
          <div className="glass hero-panel hero-panel-bloch">
            <HeroBloch />
          </div>
        </div>
      </section>

      <section className="landing-section">
        <SectionLabel>Start here</SectionLabel>
        <h2>From a single qubit to a working search algorithm</h2>
        <p className="muted">
          Qubits first, then superposition and entanglement, then the gates that move a state around, then two
          algorithms that show why any of it is worth the effort. Each module is a self-contained pass through the
          same seven steps.
        </p>
        <div className="grid cols-3" style={{ marginTop: 18 }}>
          {LESSONS.map((lesson, index) => (
            // An <article> with a real button inside, not one giant <button>: block content
            // like <p> is not allowed inside a button, and a card-sized button is a poor
            // target for screen readers.
            <article
              key={lesson.id}
              className="module-card"
              style={{
                borderColor:
                  'color-mix(in srgb, var(--accent) 30%, var(--border))',
              }}
            >
              <div className="row between">
                <span className="mono tiny dim">{String(index + 1).padStart(2, '0')}</span>
                <Badge>{lesson.level}</Badge>
              </div>
              <div className="row tight" style={{ marginTop: 4 }}>
                <span className="lesson-icon small-icon" style={{ color: topicColor(lesson.topic) }}>
                  <lesson.icon size={15} aria-hidden />
                </span>
                <strong>{lesson.title}</strong>
              </div>
              <p className="small muted" style={{ margin: '8px 0 0' }}>
                {lesson.summary}
              </p>
              <ul className="module-outline">
                {lesson.outline.slice(0, 3).map(item => (
                  <li key={item.title} className="tiny muted">
                    {item.title}
                  </li>
                ))}
                {lesson.outline.length > 3 && (
                  <li className="tiny dim">+ {lesson.outline.length - 3} more</li>
                )}
              </ul>
              <div className="row tight" style={{ marginTop: 10 }}>
                <Badge>{lesson.outline.length} lessons</Badge>
                <Badge>{lesson.minutes} min</Badge>
                <Badge tone="accent">{lesson.xp} XP</Badge>
              </div>
              <button
                className="btn-small btn-primary module-cta"
                onClick={() => navigate(route('learn', lesson.id))}
              >
                Start Learning <ArrowRight size={13} aria-hidden />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <SectionLabel>Inside a module</SectionLabel>
        <h2>Seven steps, in the same order every time</h2>
        <p className="muted">
          The rail on the left of a lesson always names the step you are on and the one after it, so you never have
          to guess what the course wants from you next.
        </p>
        <div className="grid lesson-intro">
          <ol className="stage-list">
            {LESSON_STAGES.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <li key={stage.id}>
                  <span className="stage-marker" aria-hidden>
                    <Icon size={15} />
                  </span>
                  <div>
                    <strong className="small">
                      <span className="mono tiny dim">{String(index + 1).padStart(2, '0')}</span> {stage.label}
                    </strong>
                    <p className="tiny muted" style={{ margin: '3px 0 0' }}>
                      {stage.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <Card title="What gets computed" subtitle="Why the numbers move the way they do">
            <ul className="list-plain">
              <li>
                Measurement outcomes are sampled from the Born rule over the evolved state, so an even split really
                does land near 50/50 over 1000 shots.
              </li>
              <li>
                Bloch vectors are read from the reduced density matrix, so an entangled qubit shows a shortened
                vector instead of a full-length one.
              </li>
              <li>
                Circuit challenges are marked by simulating what you built, so two different circuits that produce
                the right state both count.
              </li>
              <li>{ACHIEVEMENTS.length} achievements and module-level XP are recomputed from your own run history.</li>
            </ul>
          </Card>
        </div>
      </section>

      <section className="landing-section">
        <SectionLabel>The lab</SectionLabel>
        <h2>The gates, and the matrices behind them</h2>
        <p className="muted">
          The builder offers eight operations. These are the matrices the simulator multiplies into the state vector
          when you press Run — there is no per-lesson special casing anywhere in the engine.
        </p>
        <GateLibrary />
      </section>

      <section className="landing-cta glass">
        <h2>Ready to see a qubit interfere with itself?</h2>
        <p className="muted">
          Start with {LESSONS[0].title}: {LESSONS[0].outline.length} lessons, about {LESSONS[0].minutes} minutes,
          nothing to install.
        </p>
        <div className="row tight">
          <button className="btn-primary" onClick={start}>
            Start Learning <ArrowRight size={15} aria-hidden />
          </button>
          <button className="btn" onClick={() => navigate('learn')}>
            Browse the curriculum
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-grid">
          <div className="footer-about">
            <div className="row tight">
              <span className="brand-mark small-mark">QV</span>
              <strong className="small">QubitVerse</strong>
            </div>
            <p className="tiny muted">
              An interactive quantum computing course: {LESSONS.length} modules, a circuit builder backed by a
              state-vector simulator, and a tutor that can read the circuit you are looking at.
            </p>
            <p className="tiny dim">
              No account is created and your progress is kept in this browser only. Nothing is sent anywhere unless
              you paste your own AI key into Settings, which switches the tutor to your provider.
            </p>
          </div>
          <div>
            <h4 className="footer-heading">Modules</h4>
            <ul className="footer-links">
              {LESSONS.map(lesson => (
                <li key={lesson.id}>
                  <Link to={`#/learn/${lesson.id}`}>{lesson.title}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="footer-heading">The lab</h4>
            <ul className="footer-links">
              <li>
                <Link to="#/builder">Circuit builder</Link>
              </li>
              <li>
                <Link to="#/simulator">Simulator</Link>
              </li>
              <li>
                <Link to="#/tutor">AI tutor</Link>
              </li>
              <li>
                <Link to="#/practice">Practice</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="footer-heading">Your progress</h4>
            <ul className="footer-links">
              <li>
                <Link to="#/dashboard">Dashboard</Link>
              </li>
              <li>
                <Link to="#/progress">Progress</Link>
              </li>
              <li>
                <Link to="#/profile">Profile</Link>
              </li>
              <li>
                <Link to="#/settings">Settings</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-meta">
          <span>
            Version {SITE.version} · fits in a browser tab, runs a real simulator
          </span>
          <span>Press / inside the app to search lessons, videos and concepts.</span>
        </div>
      </footer>
    </div>
  );
}
