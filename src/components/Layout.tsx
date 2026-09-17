import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  LogOut,
  Menu as MenuIcon,
  Settings,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react';
import { getLesson } from '../data/lessons';
import { Link, NAV_ITEMS, navigate, type RouteName } from '../router';
import { useApp } from '../state/StoreProvider';
import { dashboardStats } from '../state/selectors';
import { Avatar, Badge, ProgressRing } from './ui';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';

const PRIMARY: RouteName[] = ['dashboard', 'learn', 'builder', 'simulator', 'tutor', 'practice'];
const SECONDARY: RouteName[] = ['progress', 'projects', 'profile', 'settings'];
/** The five areas that get a home on the mobile bottom bar. */
const MOBILE_TABS: RouteName[] = ['dashboard', 'learn', 'builder', 'tutor', 'practice'];

/** Icon for the "Lesson" entry, which links to whichever lesson is currently open. */
const LessonIcon = NAV_ITEMS.find(entry => entry.name === 'lesson')!.icon;

function NavLink({
  name,
  routeName,
  onNavigate,
}: {
  name: RouteName;
  /** null on pages that belong to no area (e.g. an unknown route), so nothing highlights. */
  routeName: RouteName | null;
  onNavigate?: () => void;
}) {
  const item = NAV_ITEMS.find(entry => entry.name === name);
  if (!item) return null;
  const active = routeName === name || (name === 'learn' && routeName === 'lesson');
  const Icon = item.icon;
  return (
    <Link
      to={`#/${name}`}
      className={`nav-link${active ? ' active' : ''}`}
      title={item.description}
      onClick={onNavigate}
    >
      <span className="nav-icon" aria-hidden>
        <Icon size={16} />
      </span>
      <span className="nav-label">{item.label}</span>
    </Link>
  );
}

export function Layout({
  routeName,
  title,
  subtitle,
  actions,
  children,
}: {
  /** The area being shown. Pass null when the route belongs to no area. */
  routeName: RouteName | null;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { state, actions: appActions } = useApp();
  const stats = dashboardStats(state);
  const currentLesson = state.currentLessonId ? getLesson(state.currentLessonId) : null;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Navigating on mobile closes the drawer; the page beneath should never stay covered.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [routeName]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  // The mobile drawer must be dismissable from the keyboard, not just by clicking outside.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const lessonHref =
    routeName === 'lesson' && state.currentLessonId
      ? `#/lesson/${state.currentLessonId}`
      : state.currentLessonId
        ? `#/lesson/${state.currentLessonId}`
        : '#/learn';

  const navLink = (name: RouteName, onNavigate?: () => void) =>
    name === 'lesson' ? (
      <Link
        key={name}
        to={lessonHref}
        className={`nav-link${routeName === 'lesson' ? ' active' : ''}`}
        title="Continue the lesson you are working through"
        onClick={onNavigate}
      >
        <span className="nav-icon" aria-hidden>
          <LessonIcon size={16} />
        </span>
        <span className="nav-label">
          Lesson
          {currentLesson && <span className="tiny dim nowrap"> · {currentLesson.title}</span>}
        </span>
      </Link>
    ) : (
      <NavLink key={name} name={name} routeName={routeName} onNavigate={onNavigate} />
    );

  const sidebarBody = (onNavigate?: () => void) => (
    <>
      <div className="nav-group-label">Learn</div>
      <nav className="nav">{PRIMARY.map(name => navLink(name, onNavigate))}</nav>
      <div className="nav-group-label">Track</div>
      <nav className="nav">{SECONDARY.map(name => navLink(name, onNavigate))}</nav>

      <Link to="#/profile" className="sidebar-profile" onClick={onNavigate} title="Open your learner profile">
        <Avatar name={state.user.name} size={38} />
        <span className="sidebar-profile-text">
          <strong className="small nowrap">{state.user.name}</strong>
          <span className="tiny dim">
            Level {stats.level.level} · {stats.level.label}
          </span>
          <span className="tiny dim">
            {stats.streak > 0 ? `${stats.streak}-day streak` : 'no streak yet'} · {stats.level.totalXp} XP
          </span>
        </span>
      </Link>

      <div className="card tight sidebar-level" style={{ marginBottom: 0 }}>
        <div className="row between tiny">
          <span className="muted">Level progress</span>
          <span className="dim">
            {stats.level.intoLevel}/{stats.level.needed} XP
          </span>
        </div>
        <div className="progress-track" style={{ margin: '6px 0 8px' }}>
          <div
            className="progress-fill"
            style={{ width: `${Math.min(100, (stats.level.intoLevel / stats.level.needed) * 100)}%` }}
          />
        </div>
        <div className="row tight">
          <Badge tone="default">
            {stats.lessonsCompleted}/{stats.lessonsTotal} lessons
          </Badge>
          <Badge tone="accent">{stats.overallMastery}% mastery</Badge>
        </div>
      </div>
    </>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="#/dashboard" className="brand">
          <span className="brand-mark">QV</span>
          <span className="brand-text">
            <strong>QubitVerse</strong>
            <span>Interactive quantum learning</span>
          </span>
        </Link>
        {sidebarBody()}
      </aside>

      {drawerOpen && (
        <div className="drawer-layer" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <div className="drawer">
            <div className="drawer-head">
              <Link to="#/dashboard" className="brand" onClick={() => setDrawerOpen(false)}>
                <span className="brand-mark">QV</span>
                <span className="brand-text">
                  <strong>QubitVerse</strong>
                  <span>Interactive quantum learning</span>
                </span>
              </Link>
              <button className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close navigation">
                <X size={17} />
              </button>
            </div>
            {sidebarBody(() => setDrawerOpen(false))}
          </div>
        </div>
      )}

      <main className="main">
        <header className="topbar">
          <button
            className="icon-btn drawer-toggle"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon size={18} />
          </button>

          <GlobalSearch />

          <div className="topbar-tools">
            <ThemeToggle />
            <div className="ring-wrap" title={`${stats.lessonPercent}% of the curriculum complete`}>
              <ProgressRing value={stats.lessonPercent} size={38} thickness={4} />
            </div>
            <NotificationBell />

            <div className="menu-wrap" ref={menuRef}>
              <button
                className="profile-trigger"
                onClick={() => setMenuOpen(value => !value)}
                aria-label="Profile menu"
                aria-expanded={menuOpen}
              >
                <Avatar name={state.user.name} size={30} />
                <span className="profile-trigger-text">
                  <strong className="small nowrap">{state.user.name}</strong>
                  <span className="tiny dim nowrap">
                    Level {stats.level.level} · {state.session.level}
                  </span>
                </span>
                <ChevronDown size={14} aria-hidden />
              </button>

              {menuOpen && (
                <div className="menu-panel right" role="menu">
                  <div className="menu-head">
                    <div>
                      <strong className="small">{state.user.name}</strong>
                      <div className="tiny dim">{state.session.email}</div>
                      <div className="tiny dim">
                        {state.session.level} track · {stats.level.totalXp} XP
                      </div>
                    </div>
                  </div>
                  <button className="menu-item" onClick={() => navigate('profile')}>
                    <UserRound size={15} /> Profile
                  </button>
                  <button className="menu-item" onClick={() => navigate('progress')}>
                    <TrendingUp size={15} /> Progress
                  </button>
                  <button className="menu-item" onClick={() => navigate('settings')}>
                    <Settings size={15} /> Settings
                  </button>
                  <button
                    className="menu-item danger"
                    onClick={() => {
                      appActions.signOut();
                      navigate('login');
                    }}
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-head">
          <div className="page-head-text">
            <h1>{title}</h1>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <div className="topbar-meta">
            {actions}
            {currentLesson && routeName !== 'lesson' && (
              <Badge tone="accent" title="Current lesson">
                Lesson: {currentLesson.title}
              </Badge>
            )}
            <Badge tone="default" title="Simulations run">
              {stats.simulations} runs
            </Badge>
          </div>
        </div>

        {children}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {MOBILE_TABS.map(name => {
          const item = NAV_ITEMS.find(entry => entry.name === name)!;
          const Icon = item.icon;
          const active = routeName === name || (name === 'learn' && routeName === 'lesson');
          return (
            <Link key={name} to={`#/${name}`} className={`bottom-tab${active ? ' active' : ''}`} title={item.description}>
              <Icon size={18} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {state.toast && (
        <div className={`toast ${state.toast.tone}`} role="status">
          <span className={`toast-icon ${state.toast.tone}`} aria-hidden>
            {state.toast.tone === 'error' ? (
              <AlertTriangle size={16} />
            ) : state.toast.tone === 'success' ? (
              <CheckCircle2 size={16} />
            ) : (
              <Info size={16} />
            )}
          </span>
          <div style={{ flex: 1 }}>{state.toast.text}</div>
          <button className="btn-small btn-ghost" onClick={appActions.dismissToast} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
