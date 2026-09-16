import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { CHALLENGES, getChallenge } from '../data/challenges';
import { LESSONS } from '../data/lessons';
import { QUIZZES, quizzesForLesson } from '../data/quizzes';
import { topicName } from '../data/topics';
import { navigate, route } from '../router';
import { useApp } from '../state/StoreProvider';
import { quizStats } from '../state/selectors';
import { ChallengePanel } from '../components/ChallengePanel';
import { QuizCard } from '../components/QuizCard';
import { Badge, Card, Stat } from '../components/ui';
import { Layout } from '../components/Layout';

export function PracticePage({ challengeId }: { challengeId: string | null }) {
  const { state, actions } = useApp();
  const [quizLesson, setQuizLesson] = useState<string>('all');
  const [tab, setTab] = useState<'challenges' | 'quizzes'>('challenges');

  const challenge = getChallenge(challengeId) ?? getChallenge(state.challengeId) ?? CHALLENGES[0];
  const stats = quizStats(state);

  // Opening a challenge from a deep link loads its starter circuit into the shared circuit.
  useEffect(() => {
    if (challengeId && state.challengeId !== challengeId) {
      actions.openChallenge(challengeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  const quizzes = quizLesson === 'all' ? QUIZZES : quizzesForLesson(quizLesson);
  const passedIds = new Set(state.challengeAttempts.filter(a => a.passed).map(a => a.challengeId));

  return (
    <Layout
      routeName="practice"
      title="Practice"
      subtitle="Challenges validate your actual quantum state; quizzes check the concepts"
      actions={
        <>
          <Badge tone="accent">
            {passedIds.size}/{CHALLENGES.length} challenges passed
          </Badge>
          <Badge>
            {stats.uniqueCorrect}/{QUIZZES.length} quiz questions solved
          </Badge>
        </>
      }
    >
      <div className="stack">
        <div className="grid cols-4" style={{ gap: 12 }}>
          <Stat label="Quiz attempts" value={stats.attempts} hint={`${Math.round(stats.accuracy * 100)}% accuracy`} />
          <Stat label="Challenges passed" value={`${passedIds.size}/${CHALLENGES.length}`} />
          <Stat label="Challenge attempts" value={state.challengeAttempts.length} />
          <Stat label="XP" value={state.user.xp} hint="Earned from lessons, quizzes, challenges and achievements" />
        </div>

        <Card tight>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            <button className={`tab${tab === 'challenges' ? ' active' : ''}`} onClick={() => setTab('challenges')}>
              Challenges ({CHALLENGES.length})
            </button>
            <button className={`tab${tab === 'quizzes' ? ' active' : ''}`} onClick={() => setTab('quizzes')}>
              Quiz bank ({QUIZZES.length})
            </button>
          </div>
        </Card>

        {tab === 'challenges' ? (
          <div className="grid sidebar-right">
            <ChallengePanel challenge={challenge} />

            <div className="stack">
              <Card title="All challenges" subtitle="Pick one — it loads its starter circuit">
                <div className="stack" style={{ gap: 8 }}>
                  {CHALLENGES.map(entry => {
                    const passed = passedIds.has(entry.id);
                    const attempts = state.challengeAttempts.filter(a => a.challengeId === entry.id).length;
                    return (
                      <div
                        key={entry.id}
                        className="card tight"
                        style={{
                          marginBottom: 0,
                          borderColor: entry.id === challenge.id ? 'rgba(124,92,255,0.55)' : undefined,
                        }}
                      >
                        <div className="row between">
                          <div>
                            <div className="small row tight">
                              {passed && <Check size={13} style={{ color: 'var(--good-ink)' }} aria-hidden />}
                              <span>{entry.title}</span>
                            </div>
                            <div className="tiny dim">
                              {topicName(entry.topic)} · {entry.difficulty} · {entry.xp} XP · {attempts} attempt(s)
                            </div>
                          </div>
                          <div className="row tight">
                            <button
                              className="btn-small"
                              onClick={() => {
                                actions.openChallenge(entry.id);
                                navigate(route('practice', entry.id));
                              }}
                            >
                              {entry.id === challenge.id ? 'Reload' : 'Open'}
                            </button>
                            <button
                              className="btn-small btn-ghost"
                              onClick={() => navigate(route('lesson', entry.lessonId))}
                              title="Open the lesson that teaches this"
                            >
                              Lesson
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card title="Attempt history" subtitle="Every submission is stored with its checks">
                {state.challengeAttempts.length === 0 ? (
                  <p className="muted small" style={{ margin: 0 }}>No submissions yet.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Challenge</th>
                        <th>Result</th>
                        <th>XP</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...state.challengeAttempts].reverse().slice(0, 8).map(attempt => (
                        <tr key={attempt.id}>
                          <td className="small">{getChallenge(attempt.challengeId)?.title ?? attempt.challengeId}</td>
                          <td>
                            <Badge tone={attempt.passed ? 'good' : 'bad'}>{attempt.passed ? 'passed' : 'failed'}</Badge>
                          </td>
                          <td className="mono tiny">{attempt.xpAwarded > 0 ? `+${attempt.xpAwarded}` : '—'}</td>
                          <td className="tiny dim">{new Date(attempt.attemptedAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <div className="stack">
            <Card title="Quiz bank" subtitle="Correct answers update lesson progress, XP and topic mastery">
              <div className="row tight">
                <button className={`btn-small${quizLesson === 'all' ? ' btn-primary' : ''}`} onClick={() => setQuizLesson('all')}>
                  All lessons
                </button>
                {LESSONS.map(lesson => (
                  <button
                    key={lesson.id}
                    className={`btn-small${quizLesson === lesson.id ? ' btn-primary' : ''}`}
                    onClick={() => setQuizLesson(lesson.id)}
                  >
                    {lesson.title}
                    <span className="tiny dim">
                      {' '}
                      {state.quizAttempts.filter(a => a.lessonId === lesson.id && a.correct).length}/
                      {quizzesForLesson(lesson.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </Card>
            {quizzes.map((quiz, index) => (
              <QuizCard key={quiz.id} quiz={quiz} index={index} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
