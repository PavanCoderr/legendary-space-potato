import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { Quiz } from '../data/types';
import { useApp } from '../state/StoreProvider';
import { Badge, Card } from './ui';

/** Single quiz question with answer checking, feedback and attempt history. */
export function QuizCard({ quiz, index }: { quiz: Quiz; index?: number }) {
  const { state, actions } = useApp();
  const [selected, setSelected] = useState<number | null>(null);

  const attempts = state.quizAttempts.filter(attempt => attempt.quizId === quiz.id);
  const lastAttempt = attempts[attempts.length - 1];
  const everCorrect = attempts.some(attempt => attempt.correct);

  // Reset the local choice when the question changes (e.g. a new lesson).
  useEffect(() => {
    setSelected(null);
  }, [quiz.id]);

  const answered = selected !== null;
  const correct = answered && selected === quiz.correctIndex;

  const submit = (optionIndex: number) => {
    if (answered) return;
    setSelected(optionIndex);
    actions.submitQuiz(quiz, optionIndex);
  };

  return (
    <Card
      title={`${index !== undefined ? `Q${index + 1}. ` : ''}${quiz.question}`}
      actions={<Badge tone={everCorrect ? 'good' : lastAttempt ? 'bad' : 'default'}>{everCorrect ? 'solved' : lastAttempt ? 'try again' : `+20 XP`}</Badge>}
    >
      <div className="stack" style={{ gap: 8 }}>
        {quiz.options.map((option, optionIndex) => {
          const isChosen = selected === optionIndex;
          const isCorrect = optionIndex === quiz.correctIndex;
          const showCorrect = answered && isCorrect;
          const showWrong = answered && isChosen && !isCorrect;
          return (
            <button
              key={option}
              className="btn"
              style={{
                textAlign: 'left',
                borderColor: showCorrect
                  ? 'rgba(47, 211, 165, 0.7)'
                  : showWrong
                    ? 'rgba(255, 95, 122, 0.7)'
                    : undefined,
                background: showCorrect
                  ? 'rgba(47, 211, 165, 0.12)'
                  : showWrong
                    ? 'rgba(255, 95, 122, 0.12)'
                    : undefined,
              }}
              onClick={() => submit(optionIndex)}
              disabled={answered}
            >
              <span className="mono dim">{String.fromCharCode(65 + optionIndex)}.</span> {option}
              {showCorrect && (
                <span className="row tight tiny" style={{ color: 'var(--good-ink)', display: 'inline-flex', marginLeft: 8 }}>
                  <Check size={12} aria-hidden /> correct
                </span>
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="card tight" style={{ marginTop: 12, marginBottom: 0 }}>
          <div className="row between">
            <Badge tone={correct ? 'good' : 'bad'}>{correct ? `Correct · +20 XP` : 'Not quite'}</Badge>
            {attempts.length > 1 && <span className="tiny dim">{attempts.length} attempts</span>}
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            {quiz.explanation}
          </p>
        </div>
      )}
    </Card>
  );
}
