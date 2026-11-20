import { lazy, Suspense, useEffect } from 'react';
import { useApp, useSettings } from '../store/store';
import { useRoute } from './router';
import { Shell } from './Shell';
import { SheetHost } from './SheetHost';
import { Toasts, ConfirmHost } from './Overlays';
import { Dashboard } from '../features/dashboard/Dashboard';
import { Onboarding } from '../features/onboarding/Onboarding';

const HabitsPage = lazy(() => import('../features/habits/HabitsPage'));
const GoalsPage = lazy(() => import('../features/goals/GoalsPage'));
const PlannerPage = lazy(() => import('../features/planner/PlannerPage'));
const RemindersPage = lazy(() => import('../features/reminders/RemindersPage'));
const AcademicPage = lazy(() => import('../features/academic/AcademicPage'));
const AgendaPage = lazy(() => import('../features/agenda/AgendaPage'));
const StatsPage = lazy(() => import('../features/stats/StatsPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'));

function useThemeEffect() {
  const { theme, accent } = useSettings();
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      const root = document.documentElement;
      root.dataset.theme = resolved;
      root.dataset.accent = accent;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0a0b0d' : '#f3f3ef');
      try {
        localStorage.setItem('lifeos:theme', JSON.stringify({ theme: resolved, accent }));
      } catch {
        /* ignore */
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, accent]);
}

function Page() {
  const { path } = useRoute();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);
  switch (path) {
    case '/habitos':
      return <HabitsPage />;
    case '/metas':
      return <GoalsPage />;
    case '/planejar':
      return <PlannerPage />;
    case '/lembretes':
      return <RemindersPage />;
    case '/faculdade':
      return <AcademicPage />;
    case '/agenda':
      return <AgendaPage />;
    case '/estatisticas':
      return <StatsPage />;
    case '/config':
      return <SettingsPage />;
    default:
      return <Dashboard />;
  }
}

export function App() {
  useThemeEffect();
  const onboarded = useApp((s) => s.data.settings.onboarded);
  const { path } = useRoute();

  if (!onboarded) {
    return (
      <>
        <Onboarding />
        <Toasts />
      </>
    );
  }

  return (
    <>
      <Shell>
        <Suspense fallback={<div className="page" style={{ minHeight: '60vh' }} />}>
          <Page key={path} />
        </Suspense>
      </Shell>
      <SheetHost />
      <ConfirmHost />
      <Toasts />
    </>
  );
}
