import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, BrainCircuit, Check, Play, Sparkles } from 'lucide-react';
import { getChallenge } from '../data/challenges';
import { LESSONS, getLesson } from '../data/lessons';
import { LESSON_STAGES } from '../data/stages';
import { quizzesForLesson } from '../data/quizzes';
import { topicColor } from '../data/topics';
import { circuitToCode } from '../quantum/code';
import { deserializeCircuit } from '../quantum/circuit';
import { navigate, route } from '../router';
import { useApp } from '../state/StoreProvider';
import { continueLesson, lessonCompletionPercent, lessonProgressOf } from '../state/selectors';
import { describeState, formatInitialState, formatStateVector } from '../services/analysis';
import type { TutorAction } from '../services/tutor';
import { BlochSphere } from '../components/BlochSphere';
import { ChallengePanel } from '../components/ChallengePanel';
import { CircuitGrid } from '../components/CircuitGrid';
import { InteractiveLab } from '../components/InteractiveLab';
import { QuizCard } from '../components/QuizCard';
import { ProbabilityBars, StepTimeline } from '../components/SimulationResults';
import { TutorPanel } from '../components/TutorPanel';
import { YoutubeLessonVideo } from '../components/YoutubeLessonVideo';
import { Badge, Card, ProgressBar } from '../components/ui';
import { Layout } from '../components/Layout';

const ACTION_FOR_LABEL: Record<string, TutorAction> = {
  'explain this': 'explain',
  'why did this happen?': 'why',
  'find my mistake': 'mistake',
  'give me a hint': 'hint',
  'explain my circuit': 'explain-circuit',
  'explain the result': 'explain-result',
  'improve my code': 'improve',
};

const STAGES = LESSON_STAGES;
type StageId = (typeof STAGES)[number]['id'];

function scrollToStage(id: StageId) {
  document.getElementById(`stage-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function LessonPage({ lessonId }: { lessonId: string | null }) {
  const { state, actions } = useApp();
  const fallback = continueLesson(state);
  const lesson = getLesson(lessonId) ?? fallback;
  const loadedRef = useRef<string | null>(null);

  // Entering a *different* lesson resets the shared circuit to that lesson's lab, so the
  // builder, simulator and tutor all continue from the lesson's starting point. Coming
  // back to the lesson you were already on keeps whatever you built.
  useEffect(() => {
    if (loadedRef.current === lesson.id) return;
    const previous = loadedRef.current;
    loadedRef.current = lesson.id;
    const switched = state.currentLessonId !== lesson.id;
    actions.visitLesson(lesson.id);
    if (switched || previous !== null) actions.loadCircuit(lesson.interactive.startCircuit);
    if (!lessonId) navigate(route('lesson', lesson.id), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const progress = lessonProgressOf(state, lesson.id);
  const percent = lessonCompletionPercent(state, lesson.id);
  const quizzes = quizzesForLesson(lesson.id);
  const quizDone = quizzes.length > 0 && progress.quizCorrect >= quizzes.length;
  const challenge = getChallenge(lesson.challengeId);
  const exampleCircuit = deserializeCircuit(lesson.example.circuit, lesson.example.title).circuit;
  const result = state.simulation.result;

  const doneByStage: Record<StageId, boolean> = {
    learn: progress.conceptRead,
    watch: progress.videoWatched,
    visualize: progress.simulationRun,
    experiment: progress.interactiveDone,
    'ask-ai': progress.tutorAsked,
    practice: quizDone,
    complete: progress.status === 'completed',
  };

  // "What should I do next?" — always answerable, and always one click away.
  const nextStage = STAGES.find(stage => !doneByStage[stage.id]) ?? STAGES[STAGES.length - 1];
  const nextStepCopy: Record<StageId, string> = {
    learn: 'Read the concept below and mark it as read.',
    watch: `Watch “${lesson.video.title}” (${lesson.video.duration}) and mark it as watched.`,
    visualize: 'Load the example circuit and run it to see the state, probabilities and Bloch vector.',
    experiment: 'Build the circuit yourself in the interactive lab.',
    'ask-ai': 'Ask the tutor why the result came out the way it did.',
    practice: 'Answer the quiz questions and pass the practice challenge.',
    complete: 'Mark the lesson complete to bank the XP.',
  };

  const askAbout = (prompt: string, label: string) => {
    const action = ACTION_FOR_LABEL[label.toLowerCase()];
    void actions.askTutor(prompt, action, `lesson/${lesson.id}`);
  };

  const markWatched = () => {
    actions.markStep(lesson.id, 'videoWatched');
    // Generic on purpose: only the superposition module's lab is about the H gate.
    actions.pushToast('Video marked as watched — next, try the experiment in the lab.', 'success');
  };

  return (
    <Layout
      routeName="lesson"
      title={
        <span className="row tight">
          <span className="lesson-icon small-icon" style={{ color: topicColor(lesson.topic) }}>
            <lesson.icon size={15} aria-hidden />
          </span>
          {lesson.title}
        </span>
      }
      subtitle={`${lesson.summary} · ${lesson.minutes} min · ${lesson.xp} XP`}
      actions={
        <>
          <Badge tone="default">difficulty: {lesson.level}</Badge>
          <Badge>estimated {lesson.minutes} minutes</Badge>
          <Badge tone={progress.status === 'completed' ? 'good' : 'accent'}>progress {percent}%</Badge>
        </>
      }
    >
      <div className="stack">
        <Card tight>
          <div className="row between">
            <div className="row tight">
              <button className="btn-small btn-ghost" onClick={() => navigate(route('learn', lesson.id))}>
                <ArrowLeft size={13} aria-hidden /> Module overview
              </button>
              <button className="btn-small btn-ghost" onClick={() => navigate('learn')}>
                All topics
              </button>
            </div>
            <div className="row tight">
              <Badge>
                {LESSONS.findIndex(entry => entry.id === lesson.id) + 1} of {LESSONS.length} modules
              </Badge>
              <Badge tone={progress.status === 'completed' ? 'good' : 'default'}>{progress.status}</Badge>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar value={percent} label="Lesson completion" hint={`${percent}%`} />
          </div>
        </Card>

        <div className="grid lesson-layout">
          <aside className="lesson-rail">
            <Card tight className="timeline-card">
              <div className="tiny dim" style={{ marginBottom: 8 }}>
                Lesson flow
              </div>
              <ol className="timeline">
                {STAGES.map((stage, index) => {
                  const Icon = stage.icon;
                  const isDone = doneByStage[stage.id];
                  const isNext = stage.id === nextStage.id;
                  return (
                    <li key={stage.id}>
                      <button
                        className={`timeline-step${isDone ? ' done' : ''}${isNext ? ' next' : ''}`}
                        onClick={() => scrollToStage(stage.id)}
                        title={stage.hint}
                      >
                        <span className="timeline-marker">
                          <Icon size={13} aria-hidden />
                        </span>
                        <span className="timeline-text">
                          <span className="timeline-label">
                            {index + 1}. {stage.label}
                          </span>
                          <span className="tiny dim">
                            {isDone ? 'done' : isNext ? 'next up' : stage.hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <Card tight className="next-step-card">
              <div className="tiny dim" style={{ marginBottom: 6 }}>
                What should I do next?
              </div>
              <strong className="small">{nextStage.label}</strong>
              <p className="tiny muted" style={{ margin: '6px 0 10px' }}>
                {nextStepCopy[nextStage.id]}
              </p>
              <button className="btn-small btn-primary" onClick={() => scrollToStage(nextStage.id)}>
                Go to step {STAGES.findIndex(stage => stage.id === nextStage.id) + 1} <ArrowRight size={12} />
              </button>
            </Card>

            <Card tight>
              <div className="tiny dim" style={{ marginBottom: 6 }}>
                Why did this happen?
              </div>
              <p className="tiny muted" style={{ margin: 0 }}>
                {result
                  ? describeState(result)
                  : 'Run the circuit in the experiment stage and the tutor will explain the exact numbers you got.'}
              </p>
            </Card>
          </aside>

          <div className="stack lesson-body">
            {/* 1 — LEARN */}
            <div id="stage-learn" className="stage-anchor">
              <Card
                title={lesson.concept.heading}
                subtitle="Learn · concept"
                actions={
                  <Badge tone={progress.conceptRead ? 'good' : 'default'}>
                    {progress.conceptRead ? 'read' : 'not marked yet'}
                  </Badge>
                }
              >
                {lesson.concept.paragraphs.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {lesson.concept.math && (
                  <div className="stack" style={{ gap: 8, margin: '10px 0' }}>
                    {lesson.concept.math.map(entry => (
                      <div key={entry.expression}>
                        <code className="katex-ish">{entry.expression}</code>
                        <div className="tiny dim" style={{ marginTop: 4 }}>
                          {entry.caption}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <h4 style={{ marginTop: 12 }}>Key points</h4>
                <ul className="list-plain">
                  {lesson.concept.keyPoints.map(point => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <div className="row tight" style={{ marginTop: 10 }}>
                  <button
                    className={`btn-small${progress.conceptRead ? '' : ' btn-primary'}`}
                    onClick={() => actions.markStep(lesson.id, 'conceptRead')}
                    disabled={progress.conceptRead}
                  >
                    {progress.conceptRead ? (
                      <>
                        <Check size={13} aria-hidden /> Concept marked as read
                      </>
                    ) : (
                      'I have read the concept'
                    )}
                  </button>
                  <button
                    className="btn-small btn-ghost"
                    onClick={() => askAbout('Explain this concept to me.', 'Explain this')}
                  >
                    <Sparkles size={13} aria-hidden /> Ask the tutor to explain it
                  </button>
                </div>
              </Card>
            </div>

            {/* 2 — WATCH */}
            <div id="stage-watch" className="stage-anchor">
              <YoutubeLessonVideo
                videoId={lesson.video.youtubeId}
                title={lesson.video.title}
                duration={lesson.video.duration}
                summary={lesson.video.summary}
                chapters={lesson.video.chapters}
                watched={progress.videoWatched}
                onMarkWatched={markWatched}
              />
            </div>

            {/* 3 — VISUALIZE */}
            <div id="stage-visualize" className="stage-anchor">
              <div className="stack">
                <Card
                  title={`Circuit example · ${lesson.example.title}`}
                  subtitle="Visualize · the lesson circuit, with the code that produces it"
                  actions={
                    <>
                      <button className="btn-small" onClick={() => actions.loadCircuit(lesson.example.circuit)}>
                        Load into my circuit
                      </button>
                      <button
                        className="btn-small btn-primary"
                        onClick={() => {
                          actions.loadCircuit(lesson.example.circuit);
                          actions.runSimulation(lesson.example.shots);
                        }}
                      >
                        <Play size={13} aria-hidden /> Run with {lesson.example.shots} shots
                      </button>
                    </>
                  }
                >
                  <div className="grid sidebar-right" style={{ gap: 14 }}>
                    <div>
                      <CircuitGrid circuit={exampleCircuit} interactive={false} extraColumns={0} />
                      <p className="small muted" style={{ marginTop: 10 }}>
                        {lesson.example.explanation}
                      </p>
                      <div className="tiny" style={{ color: 'var(--accent-2-ink)' }}>
                        Expected: {lesson.example.expectation}
                      </div>
                    </div>
                    <div>
                      <div className="tiny dim" style={{ marginBottom: 4 }}>
                        Qiskit-style code
                      </div>
                      <pre className="pre">{circuitToCode(exampleCircuit)}</pre>
                    </div>
                  </div>
                </Card>

                <div className="grid sidebar-right">
                  <Card
                    title="Simulation & visualization"
                    subtitle="Shared result from the current circuit"
                    actions={
                      <>
                        {state.simulation.stale && <Badge tone="warn">stale — run again</Badge>}
                        <button className="btn-small btn-primary" onClick={() => actions.runSimulation()}>
                          <Play size={13} aria-hidden /> Run current circuit
                        </button>
                        <button className="btn-small" onClick={() => navigate('simulator')}>
                          Open full simulator
                        </button>
                      </>
                    }
                  >
                    {!result ? (
                      <p className="muted small">
                        Nothing has been run yet. Press <strong>Run with {lesson.example.shots} shots</strong> above,
                        or run your own circuit here — the numbers come straight from the state-vector simulator.
                      </p>
                    ) : (
                      <div className="stack">
                        <div className="row between">
                          <span className="mono small">{describeState(result)}</span>
                          <Badge>{result.shots} shots</Badge>
                        </div>
                        {/* The same state written the way the lessons write it. */}
                        <div className="row tight">
                          <code className="katex-ish">
                            {formatInitialState(result.numQubits)} → {formatStateVector(result)}
                          </code>
                        </div>
                        <ProbabilityBars result={result} />
                      </div>
                    )}
                  </Card>

                  <Card title="Quantum state" subtitle={lesson.visualization.focus}>
                    {result ? (
                      <BlochSphere vector={result.bloch[0]} size={300} />
                    ) : (
                      <p className="muted small">Run the circuit to animate the state vector on the Bloch sphere.</p>
                    )}
                    <ul className="list-plain tiny" style={{ marginTop: 10 }}>
                      {lesson.visualization.notes.map(note => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </Card>
                </div>

                <Card
                  title="Step-by-step evolution"
                  subtitle="Every gate replayed with the same simulator code as a real run"
                  actions={
                    <button className="btn-small" onClick={() => askAbout('Explain the result of my circuit.', 'Explain the result')}>
                      Ask why
                    </button>
                  }
                >
                  <StepTimeline circuit={state.circuit} />
                </Card>
              </div>
            </div>

            {/* 4 — EXPERIMENT */}
            <div id="stage-experiment" className="stage-anchor">
              <InteractiveLab
                lesson={lesson}
                completed={progress.interactiveDone}
                onComplete={() => actions.markStep(lesson.id, 'interactiveDone')}
              />
              <Card tight className="hint-card">
                <div className="row between">
                  <span className="small muted">
                    Want more room? Take this circuit into the full builder — gates, code mode and saving.
                  </span>
                  <button className="btn-small" onClick={() => navigate('builder')}>
                    Open Circuit Builder <ArrowRight size={12} />
                  </button>
                </div>
              </Card>
            </div>

            {/* 5 — ASK AI */}
            <div id="stage-ask-ai" className="stage-anchor">
              <Card
                title="Ask the AI tutor about this lesson"
                subtitle="Ask AI · these prompts are sent with your current circuit, state and result attached"
                actions={
                  <Badge tone={progress.tutorAsked ? 'good' : 'default'}>
                    {progress.tutorAsked ? 'asked' : 'no questions yet'}
                  </Badge>
                }
              >
                <div className="row tight" style={{ marginBottom: 12 }}>
                  {lesson.aiPrompts.map(entry => (
                    <button
                      key={entry.prompt}
                      className="btn-small"
                      onClick={() => askAbout(entry.prompt, entry.label)}
                      disabled={state.tutorMessages.some(message => message.pending)}
                    >
                      {entry.label}
                    </button>
                  ))}
                  <button
                    className="btn-small btn-ghost"
                    onClick={() => askAbout('Explain like I am a beginner: what did my circuit just do?', 'Explain this')}
                  >
                    Explain like I'm a beginner
                  </button>
                </div>
                <TutorPanel route={`lesson/${lesson.id}`} height={360} />
              </Card>
            </div>

            {/* 6 — PRACTICE */}
            <div id="stage-practice" className="stage-anchor">
              <div className="stack">
                <Card
                  title="Quiz"
                  subtitle={`Practice · ${progress.quizCorrect}/${quizzes.length} correct · answer them all to close this stage`}
                  actions={
                    <Badge tone={quizDone ? 'good' : 'default'}>{quizDone ? 'quiz passed' : 'in progress'}</Badge>
                  }
                >
                  <div className="stack">
                    {quizzes.map((quiz, index) => (
                      <QuizCard key={quiz.id} quiz={quiz} index={index} />
                    ))}
                  </div>
                </Card>

                {challenge && <ChallengePanel challenge={challenge} />}
              </div>
            </div>

            {/* 7 — COMPLETE */}
            <div id="stage-complete" className="stage-anchor">
              <Card
                title="Complete this lesson"
                subtitle={`Complete · lesson progress ${percent}%`}
                actions={<Badge tone="accent">{lesson.xp} XP available</Badge>}
              >
                <div className="row tight">
                  {lesson.nextLessonId ? (
                    <button className="btn-small" onClick={() => navigate(route('lesson', lesson.nextLessonId!))}>
                      Next lesson: {getLesson(lesson.nextLessonId)?.title} <ArrowRight size={12} />
                    </button>
                  ) : (
                    <button className="btn-small" onClick={() => navigate('progress')}>
                      See your progress
                    </button>
                  )}
                  <button
                    className="btn-primary"
                    onClick={() => actions.completeLesson(lesson.id)}
                    disabled={progress.status === 'completed'}
                    title="Marks the lesson complete and awards its XP"
                  >
                    {progress.status === 'completed' ? (
                      <>
                        <Check size={14} aria-hidden /> Lesson completed
                      </>
                    ) : (
                      `Mark lesson complete (+${lesson.xp} XP)`
                    )}
                  </button>
                  <button className="btn-small btn-ghost" onClick={() => navigate('learn')}>
                    Back to the lesson library
                  </button>
                </div>
                <div className="callout" style={{ marginTop: 12 }}>
                  <div className="row tight">
                    <BrainCircuit size={14} aria-hidden />
                    <span className="small">
                      {progress.status === 'completed'
                        ? "You're ready for the next module — your XP and mastery have already updated."
                        : 'Once the concept, video, experiment, simulation and quiz checkpoints are done, this lesson completes automatically.'}
                    </span>
                  </div>
                </div>
                <p className="tiny dim" style={{ marginTop: 10, marginBottom: 0 }}>
                  Module {LESSONS.findIndex(entry => entry.id === lesson.id) + 1} of {LESSONS.length} ·{' '}
                  {challenge ? 'challenge available above' : 'no challenge for this module'}
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
