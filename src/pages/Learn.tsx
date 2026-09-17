import { useState } from 'react';
import { ArrowLeft, BookOpenCheck, Check, CirclePlay, Clock, Layers, Play, Target } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import { getChallenge } from '../data/challenges';
import { LESSONS, getLesson } from '../data/lessons';
import { TOPICS, TOPIC_MAP, topicColor } from '../data/topics';
import type { Lesson, TopicId } from '../data/types';
import { navigate, route } from '../router';
import { useApp } from '../state/StoreProvider';
import {
  achievementStatsOf,
  isLessonUnlocked,
  lessonCompletionPercent,
  lessonProgressOf,
} from '../state/selectors';
import { LessonCard } from '../components/LessonCard';
import { TopicCard } from '../components/TopicCard';
import { Badge, Card, EmptyState, ProgressBar, Stat } from '../components/ui';
import { Layout } from '../components/Layout';

/** The four questions the platform always answers, shown at the end of the library. */
function TeachingNotes() {
  const { state } = useApp();
  const stats = achievementStatsOf(state);
  return (
    <Card title="How QubitVerse teaches" subtitle="Every module follows the same end-to-end flow">
      <ol className="list-plain">
        <li>Read the concept — short, concrete explanations with the maths that matters.</li>
        <li>Watch the module's teaching video and mark it watched.</li>
        <li>Play with the interactive lab: everything you touch is a real quantum state.</li>
        <li>Study a circuit example, run it, and read the probabilities, counts and Bloch sphere.</li>
        <li>Ask the AI tutor why the result came out the way it did.</li>
        <li>Pass the quiz and the practice challenge — your XP, mastery and streak update from there.</li>
      </ol>
      <div className="row tight" style={{ marginTop: 8 }}>
        <Badge tone="good">
          {state.achievements.length} achievements unlocked of {ACHIEVEMENTS.length}
        </Badge>
        <Badge>{stats.simulations} simulations run</Badge>
      </div>
    </Card>
  );
}

/** `/learn` — the library: topic cards plus the full curriculum list. */
function LibraryPage() {
  const { state } = useApp();
  const [filter, setFilter] = useState<TopicId | 'all'>('all');
  const stats = achievementStatsOf(state);
  const lessons = filter === 'all' ? LESSONS : LESSONS.filter(lesson => lesson.topic === filter);

  return (
    <Layout
      routeName="learn"
      title="Learn Quantum Computing"
      subtitle="Master quantum concepts step by step through explanations, videos and interactive experiments."
      actions={
        <>
          <Badge tone="accent">{LESSONS.length} modules</Badge>
          <Badge>{stats.xp} XP</Badge>
        </>
      }
    >
      <div className="stack">
        <Card
          title="Choose your topic"
          subtitle="Five modules take you from a single qubit to a working search algorithm. Each one ends with a quiz and a hands-on challenge."
          actions={
            <div className="row tight">
              <Badge tone="accent">
                {stats.lessonsCompleted}/{LESSONS.length} completed
              </Badge>
              <Badge>{stats.xp} XP</Badge>
            </div>
          }
        >
          <div className="grid cols-3">
            {LESSONS.map((lesson, index) => (
              <TopicCard
                key={lesson.id}
                lesson={lesson}
                index={index + 1}
                percent={lessonCompletionPercent(state, lesson.id)}
                status={lessonProgressOf(state, lesson.id).status}
                onOpen={() => navigate(route('learn', lesson.id))}
              />
            ))}
          </div>
        </Card>

        <Card
          title="Curriculum"
          subtitle="Every lesson, in order — the same content filtered by topic"
          actions={
            <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
              <button className={`tab${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
                All topics
              </button>
              {TOPICS.map(topic => (
                <button
                  key={topic.id}
                  className={`tab${filter === topic.id ? ' active' : ''}`}
                  onClick={() => setFilter(topic.id)}
                  title={topic.description}
                >
                  <span style={{ color: topicColor(topic.id) }}>{topic.shortName}</span>
                </button>
              ))}
            </div>
          }
        >
          {lessons.map(lesson => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              index={LESSONS.findIndex(entry => entry.id === lesson.id) + 1}
              percent={lessonCompletionPercent(state, lesson.id)}
              status={lessonProgressOf(state, lesson.id).status}
              unlocked={isLessonUnlocked(state, lesson)}
              onOpen={() => navigate(route('lesson', lesson.id))}
              onChallenge={() => navigate(route('practice', lesson.challengeId))}
            />
          ))}
        </Card>

        <TeachingNotes />
      </div>
    </Layout>
  );
}

const STAGE_CHECKS: { label: string; key: 'conceptRead' | 'videoWatched' | 'interactiveDone' | 'simulationRun' | 'quiz' | 'challengePassed' }[] = [
  { label: 'Learn', key: 'conceptRead' },
  { label: 'Watch', key: 'videoWatched' },
  { label: 'Experiment', key: 'interactiveDone' },
  { label: 'Simulate', key: 'simulationRun' },
  { label: 'Practice', key: 'quiz' },
  { label: 'Complete', key: 'challengePassed' },
];

/**
 * `/learn/:topic` — the topic page.
 *
 * Left: the module's lesson navigator. Right: the selected lesson's content, the module
 * overview, and the entry point into the full lesson experience.
 */
function ModulePage({ lesson }: { lesson: Lesson }) {
  const { state } = useApp();
  const [selected, setSelected] = useState(0);
  const progress = lessonProgressOf(state, lesson.id);
  const percent = lessonCompletionPercent(state, lesson.id);
  const challenge = getChallenge(lesson.challengeId);
  const color = topicColor(lesson.topic);
  const outline = lesson.outline[Math.min(selected, lesson.outline.length - 1)];
  const totalMinutes = lesson.outline.reduce((sum, item) => sum + item.minutes, 0);

  const done = (key: (typeof STAGE_CHECKS)[number]['key']) => {
    if (key === 'quiz') return progress.quizTotal > 0 && progress.quizCorrect === progress.quizTotal;
    return progress[key];
  };

  return (
    <Layout
      routeName="learn"
      title={
        <span className="row tight">
          <span className="lesson-icon small-icon" style={{ color }}>
            <lesson.icon size={15} aria-hidden />
          </span>
          {lesson.title}
        </span>
      }
      subtitle={lesson.summary}
      actions={
        <>
          <Badge tone="default">difficulty: {lesson.level}</Badge>
          <Badge>
            <Clock size={11} aria-hidden /> estimated {totalMinutes || lesson.minutes} minutes
          </Badge>
          <Badge tone="accent">progress {percent}%</Badge>
        </>
      }
    >
      <div className="stack">
        <Card tight>
          <div className="row between">
            <button className="btn-small btn-ghost" onClick={() => navigate('learn')}>
              <ArrowLeft size={13} /> All topics
            </button>
            <div className="row tight">
              <Badge>
                <Layers size={11} aria-hidden /> {lesson.outline.length} lessons
              </Badge>
              <Badge tone={progress.status === 'completed' ? 'good' : 'default'}>{progress.status}</Badge>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar value={percent} label="Module progress" hint={`${percent}%`} />
          </div>
        </Card>

        <div className="grid topic-layout">
          <Card tight className="topic-nav">
            <div className="tiny dim" style={{ marginBottom: 8 }}>
              Lesson navigation
            </div>
            <ol className="lesson-nav">
              {lesson.outline.map((item, index) => (
                <li key={item.title}>
                  <button
                    className={`lesson-nav-item${index === selected ? ' active' : ''}`}
                    onClick={() => setSelected(index)}
                  >
                    <span className="mono tiny dim">Lesson {index + 1}</span>
                    <span className="small">{item.title}</span>
                    <span className="tiny dim">{item.minutes} min</span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="tiny dim" style={{ margin: '14px 0 8px' }}>
              Module checkpoints
            </div>
            <div className="stack" style={{ gap: 6 }}>
              {STAGE_CHECKS.map(stage => (
                <div key={stage.label} className="row between tiny">
                  <span className="muted">{stage.label}</span>
                  <span className={done(stage.key) ? 'check-mark pass' : 'check-mark'}>
                    {done(stage.key) && <Check size={12} aria-hidden />}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="stack">
            {outline && (
              <Card
                title={outline.title}
                subtitle={`Lesson ${selected + 1} of ${lesson.outline.length} · ${outline.minutes} min`}
                actions={<Badge>{lesson.level}</Badge>}
              >
                <p className="muted small">{outline.summary}</p>
                <p className="small">
                  {lesson.concept.heading}. {lesson.concept.paragraphs[0]}
                </p>
                {lesson.concept.math && lesson.concept.math.length > 0 && (
                  <div className="row tight">
                    {lesson.concept.math.map(entry => (
                      <code className="katex-ish" key={entry.expression}>
                        {entry.expression}
                      </code>
                    ))}
                  </div>
                )}
                <div className="row tight" style={{ marginTop: 12 }}>
                  <button
                    className="btn-primary"
                    onClick={() => navigate(route('lesson', lesson.id))}
                  >
                    <BookOpenCheck size={15} /> Start Learning
                  </button>
                  <button className="btn-small" onClick={() => navigate(route('lesson', lesson.id))}>
                    <CirclePlay size={13} /> Watch the video
                  </button>
                  {challenge && (
                    <button className="btn-small" onClick={() => navigate(route('practice', challenge.id))}>
                      <Target size={13} /> Challenge
                    </button>
                  )}
                </div>
              </Card>
            )}

            <Card
              title="Watch & Learn"
              subtitle={`${lesson.video.title} · ${lesson.video.duration}`}
              actions={
                <button className="btn-small" onClick={() => navigate(route('lesson', lesson.id))}>
                  <Play size={13} /> Open the player
                </button>
              }
            >
              <p className="small muted">{lesson.video.summary}</p>
              <div className="stack" style={{ gap: 4 }}>
                {lesson.video.chapters.map(chapter => (
                  <div key={chapter.at} className="row tight tiny">
                    <span className="mono dim">{chapter.at}</span>
                    <span className="muted">{chapter.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="What you will be able to do" subtitle="Objectives for this module">
              <ul className="list-plain">
                {lesson.objectives.map(objective => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
              <div className="grid cols-2" style={{ gap: 10, marginTop: 12 }}>
                <Stat label="Module XP" value={lesson.xp} hint={lesson.level} />
                <Stat
                  label="Quiz questions"
                  value={lesson.quizIds.length}
                  hint={`${progress.quizCorrect} answered correctly so far`}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

/** `/learn/:topicId` where the id names a subject area rather than a module. */
function TopicGroupPage({ topicId }: { topicId: TopicId }) {
  const { state } = useApp();
  const topic = TOPIC_MAP[topicId];
  const lessons = LESSONS.filter(lesson => lesson.topic === topicId);

  return (
    <Layout
      routeName="learn"
      title={topic.name}
      subtitle={topic.description}
      actions={
        <>
          <Badge tone="accent">{lessons.length} module(s)</Badge>
          <Badge>{lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)} min total</Badge>
        </>
      }
    >
      <div className="stack">
        <button className="btn-small btn-ghost" onClick={() => navigate('learn')} style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={13} /> All topics
        </button>
        {lessons.map(lesson => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            index={LESSONS.findIndex(entry => entry.id === lesson.id) + 1}
            percent={lessonCompletionPercent(state, lesson.id)}
            status={lessonProgressOf(state, lesson.id).status}
            unlocked={isLessonUnlocked(state, lesson)}
            onOpen={() => navigate(route('lesson', lesson.id))}
            onChallenge={() => navigate(route('practice', lesson.challengeId))}
          />
        ))}
      </div>
    </Layout>
  );
}

export function LearnPage({ topicId = null }: { topicId?: string | null }) {
  if (!topicId) return <LibraryPage />;

  const module = getLesson(topicId);
  if (module) return <ModulePage lesson={module} />;

  const topic = TOPIC_MAP[topicId as TopicId];
  if (topic) return <TopicGroupPage topicId={topic.id} />;

  return (
    <Layout
      routeName="learn"
      title="Topic not found"
      subtitle={`No module or subject area matches “${topicId}”`}
      actions={<Badge tone="bad">unknown topic</Badge>}
    >
      <EmptyState
        title="That topic does not exist yet"
        body={
          <>
            Available modules: <span className="mono">{LESSONS.map(lesson => lesson.id).join(', ')}</span>
          </>
        }
        action={
          <button className="btn-primary" onClick={() => navigate('learn')}>
            Back to the curriculum
          </button>
        }
      />
    </Layout>
  );
}
