import { useEffect, useState, type ReactNode } from 'react';
import {
  Blocks,
  BookOpenCheck,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Play,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

/**
 * Minimal hash-based router.
 *
 * The app has a public landing page, three entry screens and ten application areas,
 * with deep links such as `#/lesson/superposition` or `#/learn/superposition`. That is
 * more than enough to justify a router but not enough to justify a dependency, so the
 * routes stay declarative here and map to real pages in App.tsx.
 */
export const ROUTES = {
  home: 'home',
  login: 'login',
  signup: 'signup',
  dashboard: 'dashboard',
  learn: 'learn',
  lesson: 'lesson',
  builder: 'builder',
  simulator: 'simulator',
  tutor: 'tutor',
  practice: 'practice',
  progress: 'progress',
  projects: 'projects',
  profile: 'profile',
  settings: 'settings',
} as const;

export type RouteName = (typeof ROUTES)[keyof typeof ROUTES];

/** Routes that live behind the application shell (sidebar + topbar). */
export const APP_ROUTES: RouteName[] = [
  'dashboard',
  'learn',
  'lesson',
  'builder',
  'simulator',
  'tutor',
  'practice',
  'progress',
  'projects',
  'profile',
  'settings',
];

/** Routes anyone can open without a session. */
export const PUBLIC_ROUTES: RouteName[] = ['home', 'login', 'signup'];

export interface NavItem {
  name: RouteName;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { name: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Progress overview and quick actions' },
  { name: 'learn', label: 'Learn', icon: GraduationCap, description: 'The lesson library' },
  { name: 'lesson', label: 'Lesson', icon: BookOpenCheck, description: 'The lesson you are working through' },
  { name: 'builder', label: 'Circuit Builder', icon: Blocks, description: 'Drag gates onto wires, or write code' },
  { name: 'simulator', label: 'Simulator', icon: Play, description: 'Run circuits and read the results' },
  { name: 'tutor', label: 'AI Tutor', icon: Sparkles, description: 'Contextual help on what you are doing' },
  { name: 'practice', label: 'Practice', icon: Target, description: 'Challenges and quizzes' },
  { name: 'progress', label: 'Progress', icon: TrendingUp, description: 'XP, mastery, streaks and achievements' },
  { name: 'projects', label: 'Projects', icon: FolderKanban, description: 'Saved circuits and code' },
  { name: 'profile', label: 'Profile', icon: UserRound, description: 'Your learner profile and achievements' },
  { name: 'settings', label: 'Settings', icon: Settings, description: 'Shots, AI provider, data' },
];

export const NAV_MAP: Record<string, NavItem> = NAV_ITEMS.reduce(
  (acc, item) => ({ ...acc, [item.name]: item }),
  {} as Record<string, NavItem>,
);

function currentHash(): string {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return raw === '' ? ROUTES.home : raw;
}

export function useRoute() {
  const [hash, setHash] = useState(currentHash);

  useEffect(() => {
    const onChange = () => setHash(currentHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const segments = hash.split('/').filter(Boolean);
  const name = (segments[0] ?? ROUTES.home) as RouteName;
  const param = segments.slice(1).join('/');
  return { name, param, hash };
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const target = to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`;
  if (options.replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = target;
}

/** Builds a route string: route('lesson', 'superposition') → '#/lesson/superposition'. */
export function route(name: RouteName, param?: string): string {
  return param ? `#/${name}/${param}` : `#/${name}`;
}

/** True when the given route is the public landing page. */
export function isLanding(name: RouteName): boolean {
  return name === ROUTES.home;
}

export function Link({
  to,
  children,
  className,
  title,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`}
      className={className}
      title={title}
      onClick={() => onClick?.()}
    >
      {children}
    </a>
  );
}
