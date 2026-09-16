import { APP_ROUTES, NAV_ITEMS, PUBLIC_ROUTES, Link, useRoute } from './router';
import { useApp } from './state/StoreProvider';
import { DashboardPage } from './pages/Dashboard';
import { LearnPage } from './pages/Learn';
import { LessonPage } from './pages/Lesson';
import { BuilderPage } from './pages/Builder';
import { SimulatorPage } from './pages/Simulator';
import { TutorPage } from './pages/Tutor';
import { PracticePage } from './pages/Practice';
import { ProgressPage } from './pages/Progress';
import { ProjectsPage } from './pages/Projects';
import { ProfilePage } from './pages/Profile';
import { SettingsPage } from './pages/Settings';
import { HomePage } from './pages/Home';
import { LoginPage, SignupPage } from './pages/Auth';
import { Layout } from './components/Layout';
import { Card } from './components/ui';

/** Fallback page — keeps every hash reachable instead of showing a blank screen. */
function NotFoundPage({ hash }: { hash: string }) {
  return (
    // No area matches, so the sidebar highlights nothing instead of claiming Dashboard.
    <Layout routeName={null} title="Page not found" subtitle={`No area matches “${hash}”`}>
      <Card title="Where would you like to go?" subtitle="Every area of QubitVerse is listed below">
        <div className="row tight">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.name} to={`#/${item.name}`} className="btn">
                <Icon size={15} aria-hidden /> {item.label}
              </Link>
            );
          })}
        </div>
      </Card>
    </Layout>
  );
}

export function App() {
  const { name, param, hash } = useRoute();
  const { state } = useApp();

  // Public screens: reachable with or without a session.
  if (name === 'home') return <HomePage />;
  if (name === 'login') return <LoginPage />;
  if (name === 'signup') return <SignupPage />;

  // Everything else requires the (mocked) session — including unknown URLs, which must not
  // fall through to the not-found page and expose the application shell. Signing out sends
  // you back to this gate.
  if (!PUBLIC_ROUTES.includes(name) && !state.session.signedIn) {
    return <LoginPage requested={APP_ROUTES.includes(name) ? name : undefined} />;
  }

  switch (name) {
    case 'learn':
      return <LearnPage topicId={param || null} />;
    case 'lesson':
      return <LessonPage lessonId={param || null} />;
    case 'builder':
      return <BuilderPage />;
    case 'simulator':
      return <SimulatorPage />;
    case 'tutor':
      return <TutorPage />;
    case 'practice':
      return <PracticePage challengeId={param || null} />;
    case 'progress':
      return <ProgressPage />;
    case 'projects':
      return <ProjectsPage />;
    case 'profile':
      return <ProfilePage />;
    case 'settings':
      return <SettingsPage />;
    case 'dashboard':
      return <DashboardPage />;
    default:
      return <NotFoundPage hash={hash} />;
  }
}
