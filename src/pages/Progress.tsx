import { Check, Minus } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import { CHALLENGES } from '../data/challenges';
import { LESSONS } from '../data/lessons';
import { navigate, route } from '../router';
import { useApp } from '../state/StoreProvider';
import {
  achievementStatsOf,
  dashboardStats,
  lessonCompletionPercent,
  lessonProgressOf,
  quizStats,
  skillsBreakdown,
} from '../state/selectors';
import { dayKey } from '../state/defaults';
import { Badge, Card, ProgressBar, ProgressRing, Stat } from '../components/ui';
import { Layout } from '../components/Layout';

/** One checkpoint column in the per-lesson table. */
function CheckpointCell({ done }: { done: boolean }) {
  return (
    <td title={done ? 'done' : 'not yet'}>
      {done ? <Check size={14} style={{ color: 'var(--good-ink)' }} aria-hidden /> : <Minus size={14} className="dim" aria-hidden />}
    </td>
  );
}

export function ProgressPage() {
  const { state, actions } = useApp();
  const stats = dashboardStats(state);
  const achievementStats = achievementStatsOf(state);
  const quizzes = quizStats(state);
  const skills = skillsBreakdown(state);

  // Last 28 days of activity for the streak strip.
  const days = Array.from({ length: 28 }, (_, index) => {
    const date = new Date(Date.now() - (27 - index) * 86400000);
    const key = dayKey(date);
    return { key, active: state.activity.activeDays.includes(key), label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  });

  const unlocked = new Set(state.achievements);

  return (
    <Layout
      routeName="progress"
      title="Progress"
      subtitle="Lesson completion, quizzes, challenges, XP, streaks, mastery and projects"
      actions={
        <>
          <Badge tone="accent">Level {stats.level.level} · {stats.level.label}</Badge>
          <Badge>{stats.level.totalXp} XP total</Badge>
        </>
      }
    >
      <div className="stack">
        <div className="grid cols-4" style={{ gap: 12 }}>
          <Stat label="Lessons completed" value={`${stats.lessonsCompleted}/${stats.lessonsTotal}`} hint={`${stats.lessonPercent}% of the curriculum`} />
          <Stat label="Quiz accuracy" value={quizzes.attempts ? `${Math.round(quizzes.accuracy * 100)}%` : '—'} hint={`${quizzes.uniqueCorrect} unique question(s) solved`} />
          <Stat label="Challenges passed" value={`${stats.challengesPassed}/${stats.challengesTotal}`} hint={`${state.challengeAttempts.length} submission(s)`} />
          <Stat label="Practice streak" value={`${stats.streak} day(s)`} tone={stats.streak > 0 ? 'good' : 'default'} hint={`${stats.activeDays} active day(s)`} />
        </div>

        <div className="grid sidebar-right">
          <Card title="Overall mastery" subtitle="50% lesson progress · 30% quiz accuracy · 20% challenge completion">
            <ProgressBar value={stats.overallMastery} label="Overview" hint={`${stats.overallMastery}%`} />
            <div className="stack" style={{ gap: 10, marginTop: 12 }}>
              {stats.mastery.map(topic => (
                <ProgressBar
                  key={topic.topic}
                  value={topic.mastery}
                  label={topic.name}
                  hint={`${topic.mastery}% · ${topic.lessonsCompleted}/${topic.lessonsTotal} lessons · quizzes ${Math.round(topic.quizAccuracy * 100)}% · challenges ${topic.challengesPassed}/${topic.challengesTotal}`}
                />
              ))}
            </div>
          </Card>

          <div className="stack">
            <Card title="Quantum Journey" subtitle="Your overall completion across the curriculum">
              <div className="center" style={{ padding: '6px 0 2px' }}>
                <ProgressRing
                  value={stats.overallMastery}
                  size={148}
                  thickness={12}
                  caption={`${stats.lessonsCompleted}/${stats.lessonsTotal} lessons · ${stats.challengesPassed}/${stats.challengesTotal} challenges`}
                />
              </div>
            </Card>

            <Card title="Skills" subtitle="Each score is computed from recorded activity, never entered by hand">
              <div className="stack" style={{ gap: 10 }}>
                {skills.map(skill => (
                  <ProgressBar key={skill.key} value={skill.value} label={skill.label} hint={skill.hint} />
                ))}
              </div>
            </Card>
          </div>
        </div>

        <Card title="Activity" subtitle="Learning days drive the streak">
          <div className="row tight">
            {days.map(day => (
              <span
                key={day.key}
                title={`${day.label}${day.active ? ' · active' : ''}`}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: day.active ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'var(--track)',
                  border: '1px solid var(--border-soft)',
                  display: 'inline-block',
                }}
              />
            ))}
          </div>
          <p className="tiny dim" style={{ marginTop: 8, marginBottom: 0 }}>
            {stats.simulations} simulations run · {stats.totalShots.toLocaleString()} shots sampled ·{' '}
            {state.projects.length} project(s) saved
          </p>
        </Card>

        <Card title="Lesson breakdown" subtitle="Every checkpoint is stored per lesson">
          <table>
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Status</th>
                <th>Concept</th>
                <th>Lab</th>
                <th>Simulation</th>
                <th>Quiz</th>
                <th>Challenge</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {LESSONS.map(lesson => {
                const progress = lessonProgressOf(state, lesson.id);
                const percent = lessonCompletionPercent(state, lesson.id);
                const quizCount = lesson.quizIds.length;
                return (
                  <tr key={lesson.id}>
                    <td>
                      <button
                        className="btn-small btn-ghost"
                        onClick={() => navigate(route('lesson', lesson.id))}
                        title="Open lesson"
                      >
                        {lesson.title}
                      </button>
                    </td>
                    <td>
                      <Badge tone={progress.status === 'completed' ? 'good' : progress.status === 'in-progress' ? 'accent' : 'default'}>
                        {progress.status}
                      </Badge>
                    </td>
                    <CheckpointCell done={progress.conceptRead} />
                    <CheckpointCell done={progress.interactiveDone} />
                    <CheckpointCell done={progress.simulationRun} />
                    <td className="mono tiny">
                      {progress.quizCorrect}/{quizCount}
                    </td>
                    <CheckpointCell done={progress.challengePassed} />
                    <td className="mono tiny">{percent}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Challenges" subtitle={`${CHALLENGES.length} practice challenges tied to lessons`}>
          <table>
            <thead>
              <tr>
                <th>Challenge</th>
                <th>Difficulty</th>
                <th>Status</th>
                <th>Best result</th>
              </tr>
            </thead>
            <tbody>
              {CHALLENGES.map(challenge => {
                const attempts = state.challengeAttempts.filter(a => a.challengeId === challenge.id);
                const best = attempts.find(a => a.passed);
                const passedChecks = attempts.at(-1)?.checks.filter(c => c.passed).length ?? 0;
                const totalChecks = attempts.at(-1)?.checks.length ?? 0;
                return (
                  <tr key={challenge.id}>
                    <td>
                      <button
                        className="btn-small btn-ghost"
                        onClick={() => navigate(route('practice', challenge.id))}
                      >
                        {challenge.title}
                      </button>
                    </td>
                    <td className="tiny">{challenge.difficulty}</td>
                    <td>
                      <Badge tone={best ? 'good' : attempts.length ? 'warn' : 'default'}>
                        {best ? `passed (+${best.xpAwarded} XP)` : attempts.length ? 'in progress' : 'not attempted'}
                      </Badge>
                    </td>
                    <td className="mono tiny">{totalChecks ? `${passedChecks}/${totalChecks} checks` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Achievements" subtitle={`${unlocked.size}/${ACHIEVEMENTS.length} unlocked · bonuses are added to your XP total`}>
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
                    <strong className="small">{achievement.name}</strong>
                  </div>
                  <div className="tiny muted">{achievement.description}</div>
                  <Badge tone={isUnlocked ? 'good' : 'default'}>+{achievement.xpBonus} XP</Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Stats snapshot" subtitle="Used by the achievement engine">
          <div className="grid cols-4" style={{ gap: 10 }}>
            <div className="tiny">Lessons started: <strong>{achievementStats.lessonsStarted}</strong></div>
            <div className="tiny">Quizzes attempted: <strong>{achievementStats.quizzesTaken}</strong></div>
            <div className="tiny">Entanglement built: <strong>{achievementStats.entanglementsBuilt ? 'yes' : 'not yet'}</strong></div>
            <div className="tiny">Projects: <strong>{achievementStats.projectsCreated}</strong></div>
          </div>
          <div className="row tight" style={{ marginTop: 12 }}>
            <button
              className="btn-small btn-bad"
              onClick={() => {
                if (window.confirm('Reset all progress (XP, lessons, quizzes, challenges, achievements)? Projects and circuits are kept.')) {
                  actions.resetProgress();
                }
              }}
            >
              Reset progress
            </button>
            <button className="btn-small" onClick={() => navigate('projects')}>
              Manage projects
            </button>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
