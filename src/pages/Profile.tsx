import { useState } from 'react';
import {
  Award,
  Check,
  Flame,
  GraduationCap,
  Lock,
  LogOut,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import { LESSONS } from '../data/lessons';
import { topicColor } from '../data/topics';
import type { LearningLevel } from '../data/types';
import { navigate, route } from '../router';
import { useApp } from '../state/StoreProvider';
import {
  achievementStatsOf,
  dashboardStats,
  lessonCompletionPercent,
  lessonProgressOf,
  quizStats,
} from '../state/selectors';
import { Avatar, Badge, Card, ProgressBar, ProgressRing, Stat } from '../components/ui';
import { Layout } from '../components/Layout';

const LEVELS: LearningLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

export function ProfilePage() {
  const { state, actions } = useApp();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(state.user.name);

  const stats = dashboardStats(state);
  const achievementStats = achievementStatsOf(state);
  const quizzes = quizStats(state);
  const unlocked = new Set(state.achievements);
  const completed = LESSONS.filter(lesson => lessonProgressOf(state, lesson.id).status === 'completed');

  const saveName = () => {
    actions.setName(draftName.trim() || 'Learner');
    setEditing(false);
  };

  return (
    <Layout
      routeName="profile"
      title="Profile"
      subtitle="Who you are, how far you have come, and what you have unlocked"
      actions={
        <>
          <Badge tone="accent">
            Level {stats.level.level} · {stats.level.label}
          </Badge>
          <Badge tone="good">{stats.level.totalXp} XP</Badge>
        </>
      }
    >
      <div className="stack">
        <Card>
          <div className="profile-head">
            <Avatar name={state.user.name} size={74} />
            <div className="profile-head-main">
              {editing ? (
                <div className="row tight">
                  <input
                    value={draftName}
                    onChange={event => setDraftName(event.target.value)}
                    aria-label="Display name"
                    style={{ maxWidth: 260 }}
                  />
                  <button className="btn-small btn-primary" onClick={saveName}>
                    <Save size={13} /> Save
                  </button>
                  <button
                    className="btn-small btn-ghost"
                    onClick={() => {
                      setDraftName(state.user.name);
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="row tight">
                  <h2 style={{ margin: 0 }}>{state.user.name}</h2>
                  <button
                    className="btn-small btn-ghost"
                    onClick={() => {
                      setDraftName(state.user.name);
                      setEditing(true);
                    }}
                    aria-label="Edit display name"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                </div>
              )}
              <div className="muted small">{state.session.email}</div>
              <div className="row tight" style={{ marginTop: 8 }}>
                <Badge tone={state.session.demo ? 'default' : 'accent'}>
                  {state.session.demo ? 'demo learner' : 'signed in'}
                </Badge>
                <Badge>{state.session.level} track</Badge>
                <Badge tone={stats.streak > 0 ? 'good' : 'default'}>
                  <Flame size={12} aria-hidden /> {stats.streak}-day streak
                </Badge>
                <Badge>
                  member since {new Date(state.user.createdAt).toLocaleDateString()}
                </Badge>
              </div>
            </div>
            <div className="profile-head-ring">
              <ProgressRing value={stats.overallMastery} size={104} thickness={8} caption="Quantum journey" />
            </div>
          </div>

          <div className="stack" style={{ gap: 10, marginTop: 14 }}>
            <div className="field-label">
              <GraduationCap size={13} aria-hidden /> Learning level
            </div>
            <div className="row tight">
              {LEVELS.map(level => (
                <button
                  key={level}
                  className={`btn-small${state.session.level === level ? ' btn-primary' : ''}`}
                  onClick={() => actions.setLearningLevel(level)}
                  aria-pressed={state.session.level === level}
                >
                  {level}
                </button>
              ))}
              <button
                className="btn-small btn-ghost"
                onClick={() => navigate('settings')}
                title="Simulator defaults, AI provider and local data live in Settings"
              >
                More in Settings
              </button>
              <button
                className="btn-small btn-ghost"
                onClick={() => {
                  void actions.signOut();
                  navigate('dashboard');
                }}
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </div>
        </Card>

        <div className="grid cols-4" style={{ gap: 12 }}>
          <Stat label="Quantum XP" value={stats.level.totalXp} hint={`Level ${stats.level.level} · ${stats.level.label}`} />
          <Stat label="Lessons completed" value={`${stats.lessonsCompleted}/${stats.lessonsTotal}`} hint={`${stats.lessonPercent}% of the curriculum`} />
          <Stat
            label="Quiz score"
            value={quizzes.attempts ? `${Math.round(quizzes.accuracy * 100)}%` : '—'}
            hint={`${quizzes.uniqueCorrect} question(s) solved`}
            tone={quizzes.accuracy >= 0.8 && quizzes.attempts > 0 ? 'good' : 'default'}
          />
          <Stat label="Simulations run" value={stats.simulations} hint={`${stats.totalShots.toLocaleString()} shots sampled`} />
        </div>

        <div className="grid sidebar-right">
          <Card title="Module progress" subtitle="Every checkpoint is stored per lesson">
            <div className="stack" style={{ gap: 12 }}>
              {LESSONS.map(lesson => (
                <div key={lesson.id}>
                  <ProgressBar
                    value={lessonCompletionPercent(state, lesson.id)}
                    label={
                      <span className="row tight">
                        <span className="lesson-icon small-icon" style={{ color: topicColor(lesson.topic) }}>
                          <lesson.icon size={15} aria-hidden />
                        </span>
                        {lesson.title}
                      </span>
                    }
                    hint={`${lessonCompletionPercent(state, lesson.id)}% · ${lesson.outline.length} lessons · ${lesson.minutes} min`}
                  />
                </div>
              ))}
            </div>
            <div className="row tight" style={{ marginTop: 12 }}>
              <button className="btn-small" onClick={() => navigate('learn')}>
                Open the curriculum
              </button>
              <button className="btn-small btn-ghost" onClick={() => navigate('progress')}>
                Detailed progress
              </button>
            </div>
          </Card>

          <div className="stack">
            <Card title="Completed lessons" subtitle={`${completed.length} of ${LESSONS.length}`}>
              {completed.length === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>
                  Nothing completed yet — start with {LESSONS[0].title}.
                </p>
              ) : (
                <div className="stack" style={{ gap: 6 }}>
                  {completed.map(lesson => (
                    <div key={lesson.id} className="row between">
                      <span className="row tight small">
                        <lesson.icon size={14} aria-hidden /> {lesson.title}
                      </span>
                      <button className="btn-small" onClick={() => navigate(route('lesson', lesson.id))}>
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Capability snapshot" subtitle="What the achievement engine sees">
              <div className="stack" style={{ gap: 8 }}>
                <ProgressBar value={achievementStats.lessonsStarted} max={LESSONS.length} label="Lessons started" hint={`${achievementStats.lessonsStarted}/${LESSONS.length}`} />
                <ProgressBar value={achievementStats.quizzesCorrect} max={Math.max(1, achievementStats.quizzesTaken)} label="Quiz questions correct" hint={`${achievementStats.quizzesCorrect}/${achievementStats.quizzesTaken}`} />
                <ProgressBar value={achievementStats.challengesPassed} max={Math.max(1, achievementStats.projectsCreated + 5)} label="Challenges passed" hint={`${achievementStats.challengesPassed}`} />
                <ProgressBar value={achievementStats.projectsCreated} max={Math.max(6, achievementStats.projectsCreated)} label="Saved projects" hint={`${achievementStats.projectsCreated}`} />
              </div>
              <div className="row tight" style={{ marginTop: 12 }}>
                <button className="btn-small" onClick={() => navigate('builder')}>
                  <Zap size={13} /> Build a circuit
                </button>
                <button className="btn-small" onClick={() => navigate('practice')}>
                  <Sparkles size={13} /> Practise
                </button>
              </div>
            </Card>
          </div>
        </div>

        <Card
          title="Achievements"
          subtitle={`${unlocked.size}/${ACHIEVEMENTS.length} unlocked · bonuses are added to your XP total`}
          actions={
            <button
              className="btn-small btn-bad"
              onClick={() => {
                if (window.confirm('Reset all progress (XP, lessons, quizzes, challenges, achievements)? Projects and circuits are kept.')) {
                  actions.resetProgress();
                }
              }}
            >
              <RotateCcw size={13} /> Reset progress
            </button>
          }
        >
          <div className="grid cols-3" style={{ gap: 10 }}>
            {ACHIEVEMENTS.map(achievement => {
              const isUnlocked = unlocked.has(achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={`card tight achievement${isUnlocked ? ' unlocked' : ''}`}
                  style={{ marginBottom: 0 }}
                >
                  <div className="row tight">
                    <span className={`achievement-icon${isUnlocked ? '' : ' locked'}`} aria-hidden>
                      <achievement.icon size={19} />
                    </span>
                    <div className="achievement-title">
                      <strong className="small">{achievement.name}</strong>
                      <div className="tiny dim row tight">
                        {isUnlocked ? (
                          <>
                            <Check size={11} aria-hidden /> unlocked
                          </>
                        ) : (
                          <>
                            <Lock size={11} aria-hidden /> locked
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="tiny muted" style={{ margin: '6px 0' }}>
                    {achievement.description}
                  </p>
                  <Badge tone={isUnlocked ? 'good' : 'default'}>
                    <Award size={11} aria-hidden /> +{achievement.xpBonus} XP
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
