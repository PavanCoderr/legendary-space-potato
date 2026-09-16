import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { ACHIEVEMENTS } from '../data/achievements';
import { getChallenge } from '../data/challenges';
import { getLesson } from '../data/lessons';
import { navigate } from '../router';
import { useApp } from '../state/StoreProvider';
import { continueLesson, dashboardStats, lessonCompletionPercent, lessonProgressOf } from '../state/selectors';

const READ_KEY = 'qubitverse.notifications.read.v1';

interface Notification {
  id: string;
  title: string;
  body: string;
  href: string;
  tone: 'good' | 'accent' | 'warn' | 'default';
}

/** Turns the learner's current state into actionable nudges — never a generic feed. */
export function deriveNotifications(state: ReturnType<typeof useApp>['state']): Notification[] {
  const list: Notification[] = [];
  const stats = dashboardStats(state);
  const next = continueLesson(state);
  const progress = lessonProgressOf(state, next.id);
  const percent = lessonCompletionPercent(state, next.id);
  const challenge = getChallenge(next.challengeId);

  if (stats.streak > 0) {
    list.push({
      id: `streak-${stats.streak}`,
      title: `${stats.streak}-day learning streak`,
      body: 'Finish one step today to keep it alive.',
      href: '#/progress',
      tone: 'good',
    });
  }

  if (progress.status !== 'completed') {
    list.push({
      id: `continue-${next.id}`,
      title: `Continue ${next.title}`,
      body: `${percent}% complete${progress.videoWatched ? '' : ' · teaching video not watched yet'}.`,
      href: `#/lesson/${next.id}`,
      tone: 'accent',
    });
  }

  if (challenge && !progress.challengePassed) {
    list.push({
      id: `challenge-${challenge.id}`,
      title: 'Practice challenge waiting',
      body: `${challenge.title} · ${challenge.difficulty}`,
      href: `#/practice/${challenge.id}`,
      tone: 'warn',
    });
  }

  const unlockedAchievements = state.achievements
    .map(id => ACHIEVEMENTS.find(entry => entry.id === id))
    .filter(Boolean)
    .slice(-2)
    .reverse();
  unlockedAchievements.forEach(achievement => {
    if (!achievement) return;
    list.push({
      id: `achievement-${achievement.id}`,
      title: `Achievement unlocked: ${achievement.name}`,
      body: `${achievement.description} (+${achievement.xpBonus} XP)`,
      href: '#/profile',
      tone: 'good',
    });
  });

  if (state.challengeChecks && state.challengeChecks.some(check => !check.passed)) {
    list.push({
      id: 'challenge-checks',
      title: 'Challenge feedback ready',
      body: 'Some checks did not pass — see what the validator measured.',
      href: '#/practice',
      tone: 'warn',
    });
  }

  if (list.length === 0) {
    list.push({
      id: 'welcome',
      title: 'Welcome to QubitVerse',
      body: `Start with ${getLesson('qubits')?.title ?? 'the Qubits lesson'} — it takes about 8 minutes.`,
      href: '#/lesson/qubits',
      tone: 'accent',
    });
  }

  return list.slice(0, 6);
}

export function NotificationBell() {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(READ_KEY);
      setRead(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRead([]);
    }
  }, []);

  const persist = (ids: string[]) => {
    setRead(ids);
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch {
      /* storage is optional — the badge simply reappears */
    }
  };

  const notifications = useMemo(() => deriveNotifications(state), [state]);
  const unread = notifications.filter(entry => !read.includes(entry.id));

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const openNotification = (href: string) => {
    navigate(href);
    setOpen(false);
  };

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        className="icon-btn"
        onClick={() => setOpen(value => !value)}
        aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ''}`}
        title="Notifications"
      >
        {unread.length > 0 ? <BellRing size={17} /> : <Bell size={17} />}
        {unread.length > 0 && <span className="count-badge">{unread.length}</span>}
      </button>

      {open && (
        <div className="menu-panel" role="menu">
          <div className="menu-head">
            <strong>Notifications</strong>
            <button
              className="btn-small btn-ghost"
              onClick={() => persist(notifications.map(entry => entry.id))}
              disabled={unread.length === 0}
            >
              <CheckCheck size={13} /> Mark all read
            </button>
          </div>
          <div className="menu-scroll">
            {notifications.map(entry => {
              const isUnread = !read.includes(entry.id);
              return (
                <button
                  key={entry.id}
                  className={`notif${isUnread ? ' unread' : ''}`}
                  onClick={() => {
                    if (isUnread) persist([...read, entry.id]);
                    openNotification(entry.href);
                  }}
                >
                  <span className={`dot ${entry.tone}`} aria-hidden />
                  <span>
                    <span className="notif-title">{entry.title}</span>
                    <span className="notif-body">{entry.body}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
