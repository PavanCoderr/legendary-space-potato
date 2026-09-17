import { ArrowRight, Blocks, Check, Lock, Play, Sparkles, Target } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import { LESSONS, getLesson } from '../data/lessons';
import { SAMPLE_CIRCUITS } from '../data/presets';
import { topicColor } from '../data/topics';
import { navigate, route } from '../router';
import { useApp } from '../state/StoreProvider';
import {
  continueLesson,
  dashboardStats,
  lessonCompletionPercent,
  lessonProgressOf,
  recentActivity,
  recentProjects,
  recommendedLesson,
} from '../state/selectors';
import { Badge, Card, ProgressBar, Stat } from '../components/ui';
import { Layout } from '../components/Layout';

export function DashboardPage() {
  const { state, actions } = useApp();
  const stats = dashboardStats(state);
  const next = continueLesson(state);
  const recommended = recommendedLesson(state);
  const projects = recentProjects(state, 3);
  const activity = recentActivity(state, 6);
  const nextProgress = lessonProgressOf(state, next.id);
  const completed = LESSONS.filter(lesson => lessonProgressOf(state, lesson.id).status === 'completed');

  const quickRun = (presetId: string) => {
    actions.loadPreset(presetId);
    navigate('simulator');
  };

  return (
    <Layout
      routeName="dashboard"
      title={`Welcome back, ${state.user.name}`}
      subtitle="Pick up where you left off, or jump straight into a working circuit"
      actions={
        <>
          <Badge tone="accent">
            Level {stats.level.level} · {stats.level.label}
          </Badge>
          {stats.streak > 0 && <Badge tone="good">{stats.streak}-day streak</Badge>}
        </>
      }
    >
      <div className="stack">
      <div className="grid cols-4" style={{ gap: 12 }}>
        <Stat
          label="Quantum XP"
          value={stats.level.totalXp}
          hint={`Level ${stats.level.level} · ${stats.level.label} · ${stats.level.intoLevel}/${stats.level.needed} XP to next level`}
        />
        <Stat
          label="Lessons completed"
          value={`${stats.lessonsCompleted}/${stats.lessonsTotal}`}
          hint={`${stats.lessonPercent}% of the curriculum`}
        />
        <Stat
          label="Practice streak"
          value={`${stats.streak} ${stats.streak === 1 ? 'day' : 'days'}`}
          hint={`${stats.activeDays} active day(s) recorded`}
          tone={stats.streak > 0 ? 'good' : 'default'}
        />
        <Stat
          label="Quiz accuracy"
          value={stats.quizzes.attempts === 0 ? '—' : `${Math.round(stats.quizzes.accuracy * 100)}%`}
          hint={`${stats.quizzes.uniqueCorrect} question(s) solved · ${stats.quizzes.attempts} attempt(s)`}
        />
      </div>

      <div className="grid sidebar-right">
        <div className="stack">
          <Card
            title="Continue learning"
            subtitle={`${next.title} · ${next.minutes} min · ${next.xp} XP`}
            actions={<Badge tone="accent">{lessonCompletionPercent(state, next.id)}% complete</Badge>}
          >
            <p className="muted small">{next.summary}</p>
            <ProgressBar
              value={lessonCompletionPercent(state, next.id)}
              label="Lesson progress"
              hint={`${nextProgress.conceptRead ? '✓' : '○'} concept · ${nextProgress.interactiveDone ? '✓' : '○'} lab · ${nextProgress.simulationRun ? '✓' : '○'} simulation · ${nextProgress.quizCorrect}/${nextProgress.quizTotal} quiz · ${nextProgress.challengePassed ? '✓' : '○'} challenge`}
            />
            <div className="row tight" style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={() => navigate(route('lesson', next.id))}>
                {nextProgress.status === 'not-started' ? 'Start lesson' : 'Resume lesson'}
              </button>
              <button
                className="btn-small"
                onClick={() => {
                  actions.loadCircuit(next.interactive.startCircuit);
                  navigate('builder');
                }}
              >
                Open its lab circuit in the Builder
              </button>
            </div>
          </Card>

          <Card
            title="Recommended lesson"
            subtitle={`${recommended.title} · ${recommended.summary}`}
            actions={<Badge>{recommended.level}</Badge>}
          >
            <div className="row tight">
              <button className="btn-small" onClick={() => navigate(route('lesson', recommended.id))}>
                Open recommended lesson
              </button>
              <button className="btn-small btn-ghost" onClick={() => navigate('learn')}>
                Browse all {LESSONS.length} lessons
              </button>
            </div>
          </Card>

          <Card title="Topic mastery" subtitle={`Blended from lesson progress, quiz accuracy and challenges · overall ${stats.overallMastery}%`}>
            <div className="stack" style={{ gap: 12 }}>
              {stats.mastery.map(topic => (
                <div key={topic.topic}>
                  <ProgressBar
                    value={topic.mastery}
                    label={
                      <span style={{ color: topicColor(topic.topic as never) }}>
                        {topic.name}
                      </span>
                    }
                    hint={`${topic.mastery}% · ${topic.lessonsCompleted}/${topic.lessonsTotal} lessons · ${topic.challengesPassed}/${topic.challengesTotal} challenges`}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Completed lessons" subtitle={`${completed.length} of ${LESSONS.length}`}>
            {completed.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                Nothing completed yet — the Superposition lesson is the best starting point.
              </p>
            ) : (
              <div className="row tight">
                {completed.map(lesson => (
                  <button key={lesson.id} className="btn-small" onClick={() => navigate(route('lesson', lesson.id))}>
                    <Check size={13} aria-hidden /> {lesson.title}
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Quick actions" subtitle="Jump straight into a working circuit">
            <div className="stack" style={{ gap: 8 }}>
              <button
                className="btn"
                onClick={() => {
                  actions.clearCircuit();
                  navigate('builder');
                }}
              >
                <Blocks size={15} aria-hidden /> Start an empty circuit
              </button>
              {SAMPLE_CIRCUITS.slice(0, 4).map(preset => (
                /* The two spans are styled separately, but the accessible-name algorithm trims
                   whitespace at every element boundary, which would read this as
                   "Superposition— H on one qubit". The explicit label restores the separator. */
                <button
                  key={preset.id}
                  className="btn"
                  aria-label={`${preset.name} — ${preset.description}`}
                  onClick={() => quickRun(preset.id)}
                >
                  <Play size={14} aria-hidden />
                  <span className="nowrap">{preset.name}</span>
                  <span className="muted tiny" aria-hidden>{` — ${preset.description}`}</span>
                </button>
              ))}
              <button
                className="btn"
                onClick={() => {
                  actions.openLessonChallenge(next.id);
                  navigate('practice');
                }}
              >
                <Target size={15} aria-hidden /> Practice challenge: {next.title}
              </button>
              <button className="btn" onClick={() => navigate('tutor')}>
                <Sparkles size={15} aria-hidden /> Ask the AI tutor
                <ArrowRight size={13} aria-hidden />
              </button>
            </div>
          </Card>

          <Card
            title="Recent activity"
            subtitle="Rebuilt from your quiz attempts, challenge submissions and completed lessons"
          >
            {activity.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                Nothing recorded yet — finish a step and it shows up here.
              </p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {activity.map(item => (
                  <button
                    key={item.id}
                    className="activity-row"
                    onClick={() => navigate(item.href)}
                    title="Open where this happened"
                  >
                    <span className={`dot ${item.tone}`} aria-hidden />
                    <span>
                      <span className="small">{item.title}</span>
                      <span className="tiny dim">{item.detail}</span>
                      <span className="tiny dim">{new Date(item.at).toLocaleString()}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="Recent projects" subtitle={`${state.projects.length} saved`}>
            {projects.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>No projects yet — save a circuit from the Builder.</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {projects.map(project => (
                  <div key={project.id} className="row between">
                    <div>
                      <div className="small">{project.name}</div>
                      <div className="tiny dim">
                        {project.circuit.numQubits} qubit(s) · {project.circuit.ops.length} gates · updated{' '}
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className="btn-small"
                      onClick={() => {
                        actions.openProject(project.id);
                        navigate('builder');
                      }}
                    >
                      Open
                    </button>
                  </div>
                ))}
                <button className="btn-small btn-ghost" onClick={() => navigate('projects')}>
                  Manage all projects
                </button>
              </div>
            )}
          </Card>

          <Card title="Simulation activity" subtitle="Real runs with the in-browser state-vector simulator">
            <div className="grid cols-2" style={{ gap: 10 }}>
              <Stat label="Runs" value={stats.simulations} />
              <Stat label="Shots sampled" value={stats.totalShots.toLocaleString()} />
              <Stat label="Challenges passed" value={`${stats.challengesPassed}/${stats.challengesTotal}`} />
              <Stat label="Projects" value={stats.projects} />
            </div>
          </Card>

          <Card title="Achievements" subtitle={`${state.achievements.length}/${ACHIEVEMENTS.length} unlocked`}>
            <div className="row tight">
              {ACHIEVEMENTS.map(achievement => {
                const unlocked = state.achievements.includes(achievement.id);
                return (
                  <Badge
                    key={achievement.id}
                    tone={unlocked ? 'good' : 'default'}
                    title={`${achievement.description} (+${achievement.xpBonus} XP)`}
                  >
                    <span aria-hidden className={`achievement-icon${unlocked ? '' : ' locked'}`}>
                      <achievement.icon size={14} />
                    </span>
                    {achievement.name}
                    {!unlocked && <Lock size={10} aria-hidden className="dim" />}
                  </Badge>
                );
              })}
            </div>
          </Card>

          {getLesson(state.currentLessonId) && (
            <Card title="Current context" subtitle="Shared across builder, simulator, tutor and practice">
              <div className="small">
                Lesson: <strong>{getLesson(state.currentLessonId)!.title}</strong>
              </div>
              <div className="small muted">
                Circuit: {state.circuit.numQubits} qubit(s), {state.circuit.ops.length} gate(s)
                {state.simulation.result ? ` · last run ${state.simulation.result.shots} shots` : ' · not run yet'}
              </div>
            </Card>
          )}
        </div>
      </div>
      </div>
    </Layout>
  );
}
