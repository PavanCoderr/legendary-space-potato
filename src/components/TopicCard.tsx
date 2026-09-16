import { ArrowRight, BookOpenCheck, Clock, Layers } from 'lucide-react';
import { topicColor } from '../data/topics';
import type { Lesson } from '../data/types';
import { Badge, ProgressBar } from './ui';

/**
 * Topic (module) card used by the Learn library.
 *
 * Shows the number, name, description, difficulty, progress, lesson count and estimated
 * time, plus the "Start Learning" action the curriculum needs.
 */
export function TopicCard({
  lesson,
  index,
  percent,
  status,
  onOpen,
}: {
  lesson: Lesson;
  index: number;
  percent: number;
  status: 'not-started' | 'in-progress' | 'completed';
  onOpen: () => void;
}) {
  const color = topicColor(lesson.topic);
  return (
    <article className="topic-card" style={{ borderColor: `${color}44` }}>
      <header className="row between">
        <span className="mono tiny dim">{String(index).padStart(2, '0')}</span>
        <Badge tone={status === 'completed' ? 'good' : status === 'in-progress' ? 'accent' : 'default'}>
          {status.replace('-', ' ')}
        </Badge>
      </header>

      <div className="row tight" style={{ marginTop: 6 }}>
        <span className="lesson-icon small-icon" style={{ color }}>
          <lesson.icon size={15} aria-hidden />
        </span>
        <h3 style={{ margin: 0 }}>{lesson.title}</h3>
      </div>

      <p className="small muted" style={{ margin: '8px 0 10px' }}>
        {lesson.summary}
      </p>

      <div className="row tight" style={{ marginBottom: 10 }}>
        <Badge>
          <Layers size={11} aria-hidden /> {lesson.outline.length} lessons
        </Badge>
        <Badge>
          <Clock size={11} aria-hidden /> {lesson.minutes} min
        </Badge>
        <Badge>{lesson.level}</Badge>
        <Badge tone="accent">{lesson.xp} XP</Badge>
      </div>

      <ProgressBar value={percent} label="Progress" hint={`${percent}%`} />

      <ol className="topic-outline">
        {lesson.outline.slice(0, 4).map((item, position) => (
          <li key={item.title}>
            <span className="mono tiny dim">L{position + 1}</span> {item.title}
            <span className="tiny dim"> · {item.minutes} min</span>
          </li>
        ))}
      </ol>

      <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onOpen}>
        <BookOpenCheck size={15} />
        {status === 'not-started' ? 'Start Learning' : status === 'completed' ? 'Review module' : 'Continue Learning'}
        <ArrowRight size={14} />
      </button>
    </article>
  );
}
