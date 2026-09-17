import { CheckCircle2, CirclePlay, Lock, Target } from 'lucide-react';
import { LESSONS } from '../data/lessons';
import { TOPICS, topicColor } from '../data/topics';
import type { Lesson } from '../data/types';
import { Badge, ProgressBar } from './ui';

/** One row of the curriculum: number, title, status, progress and the two entry points. */
export function LessonCard({
  lesson,
  index,
  percent,
  status,
  unlocked,
  onOpen,
  onChallenge,
}: {
  lesson: Lesson;
  index: number;
  percent: number;
  status: 'not-started' | 'in-progress' | 'completed';
  unlocked: boolean;
  onOpen: () => void;
  onChallenge: () => void;
}) {
  const color = topicColor(lesson.topic);
  const topic = TOPICS.find(entry => entry.id === lesson.topic);
  return (
    <div className={`lesson-card${unlocked ? '' : ' locked'}`}>
      <div className="lesson-icon" style={{ color }}>
        <lesson.icon size={21} aria-hidden />
      </div>
      <div>
        <div className="row tight">
          <strong>
            {index}. {lesson.title}
          </strong>
          <Badge tone={status === 'completed' ? 'good' : status === 'in-progress' ? 'accent' : 'default'}>
            {status === 'completed' ? (
              <>
                <CheckCircle2 size={11} aria-hidden /> completed
              </>
            ) : (
              status.replace('-', ' ')
            )}
          </Badge>
          <Badge>{topic?.shortName}</Badge>
          <Badge>{lesson.minutes} min</Badge>
          <Badge tone="accent">{lesson.xp} XP</Badge>
          {lesson.video.duration && <Badge tone="default">{`video ${lesson.video.duration}`}</Badge>}
        </div>
        <div className="muted small">{lesson.summary}</div>
        <div style={{ maxWidth: 420, marginTop: 8 }}>
          <ProgressBar value={percent} label="Progress" hint={`${percent}%`} />
        </div>
        <div className="tiny dim" style={{ marginTop: 6 }}>
          Objectives: {lesson.objectives.slice(0, 2).join(' · ')}
        </div>
        {!unlocked && (
          <div className="tiny row tight" style={{ color: 'var(--warn-ink)', marginTop: 6 }}>
            <Lock size={11} aria-hidden />
            Prerequisites still open:{' '}
            {lesson.prerequisites.map(id => LESSONS.find(l => l.id === id)?.title ?? id).join(', ')} — you can still
            open it, the earlier lessons just make it easier.
          </div>
        )}
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <button className="btn-primary" onClick={onOpen}>
          {status === 'not-started' ? 'Start' : status === 'completed' ? 'Review' : 'Continue'}
        </button>
        <button className="btn-small" onClick={onChallenge} title="Jump to this lesson's practice challenge">
          <Target size={12} /> Challenge
        </button>
        <button
          className="btn-small btn-ghost"
          onClick={onOpen}
          title="The teaching video is the second stage of the lesson"
        >
          <CirclePlay size={12} /> Video
        </button>
      </div>
    </div>
  );
}
