import { useMemo, type ReactNode } from 'react';
import {
  Bell, CalendarDays, ChartColumn, CircleCheck, GraduationCap, LayoutDashboard, ListTodo, Moon, Plus, Settings, Sun, Target, Zap,
} from 'lucide-react';
import { cx } from '../ui/components';
import { navigate, useRoute } from './router';
import { actions, useData } from '../store/store';
import { useMinute, useToday } from '../store/clock';
import { openSheet } from '../store/ui';
import { reminderFireAt } from '../core/recurrence';

interface NavDef {
  path: string;
  label: string;
  icon: ReactNode;
  match?: string[];
}

const NAV_MAIN: NavDef[] = [
  { path: '/', label: 'Início', icon: <LayoutDashboard size={19} /> },
  { path: '/habitos', label: 'Hábitos', icon: <CircleCheck size={19} /> },
  { path: '/metas', label: 'Metas semanais', icon: <Target size={19} /> },
  { path: '/planejar', label: 'Planejamento', icon: <ListTodo size={19} /> },
  { path: '/lembretes', label: 'Lembretes', icon: <Bell size={19} /> },
  { path: '/faculdade', label: 'Faculdade', icon: <GraduationCap size={19} /> },
  { path: '/agenda', label: 'Agenda', icon: <CalendarDays size={19} /> },
];
const NAV_MORE: NavDef[] = [
  { path: '/estatisticas', label: 'Estatísticas', icon: <ChartColumn size={19} /> },
  { path: '/config', label: 'Configurações', icon: <Settings size={19} /> },
];

const TABS: NavDef[] = [
  { path: '/', label: 'Início', icon: <LayoutDashboard size={21} /> },
  { path: '/habitos', label: 'Hábitos', icon: <CircleCheck size={21} />, match: ['/metas'] },
  { path: '/planejar', label: 'Planejar', icon: <ListTodo size={21} />, match: ['/lembretes'] },
  { path: '/faculdade', label: 'Faculdade', icon: <GraduationCap size={21} /> },
  { path: '/agenda', label: 'Agenda', icon: <CalendarDays size={21} /> },
];

export function BrandMark({ size = 17 }: { size?: number }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Zap size={size} strokeWidth={2.6} fill="currentColor" />
    </span>
  );
}

function useBadges() {
  const data = useData();
  const today = useToday();
  const minute = useMinute();
  return useMemo(() => {
    const academicOverdue = Object.values(data.academic).filter((a) => a.status !== 'concluido' && a.date < today).length;
    const remindersDue = Object.values(data.reminders).filter((r) => !r.done && reminderFireAt(r) <= minute).length;
    return { academicOverdue, remindersDue };
  }, [data, today, minute]);
}

export function Shell({ children }: { children: ReactNode }) {
  const { path } = useRoute();
  const data = useData();
  const badges = useBadges();
  const theme = data.settings.theme;
  const isActive = (n: NavDef) => n.path === path || n.match?.includes(path);

  const toggleTheme = () => {
    const resolved = document.documentElement.dataset.theme;
    actions.updateSettings({ theme: resolved === 'dark' ? 'light' : 'dark' });
  };

  const badgeFor = (p: string) => (p === '/faculdade' ? badges.academicOverdue : p === '/lembretes' ? badges.remindersDue : 0);

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand">
          <BrandMark />
          <div className="brand-name">
            Ritmora
          </div>
        </div>
        <button className="btn btn-accent btn-block sidebar-quick" onClick={() => openSheet({ kind: 'quick' })}>
          <Plus size={18} strokeWidth={2.5} /> Registro rápido
        </button>
        {NAV_MAIN.map((n) => {
          const b = badgeFor(n.path);
          return (
            <a key={n.path} href={'#' + n.path} className={cx('nav-item', isActive(n) && 'active')} aria-current={isActive(n) ? 'page' : undefined}>
              {n.icon}
              {n.label}
              {b > 0 && <span className="nav-badge">{b}</span>}
            </a>
          );
        })}
        <div className="nav-group-label">Análise e ajustes</div>
        {NAV_MORE.map((n) => (
          <a key={n.path} href={'#' + n.path} className={cx('nav-item', isActive(n) && 'active')} aria-current={isActive(n) ? 'page' : undefined}>
            {n.icon}
            {n.label}
          </a>
        ))}
        <div className="sidebar-foot">
          <button className="nav-item" onClick={toggleTheme}>
            {document.documentElement.dataset.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            {theme === 'system' ? 'Tema do sistema' : document.documentElement.dataset.theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <a className="topbar-brand" href="#/">
            <BrandMark size={15} />
            <span className="topbar-title">Ritmora</span>
          </a>
          <button className={cx('icon-btn', path === '/lembretes' && 'icon-btn-filled')} aria-label="Lembretes" onClick={() => navigate('/lembretes')} style={{ position: 'relative' }}>
            <Bell size={20} />
            {badges.remindersDue > 0 && <span className="tab-dot" style={{ top: 6, left: 24 }} />}
          </button>
          <button className={cx('icon-btn', path === '/estatisticas' && 'icon-btn-filled')} aria-label="Estatísticas" onClick={() => navigate('/estatisticas')}>
            <ChartColumn size={20} />
          </button>
          <button className={cx('icon-btn', path === '/config' && 'icon-btn-filled')} aria-label="Configurações" onClick={() => navigate('/config')}>
            <Settings size={20} />
          </button>
        </div>
        {children}
      </main>

      <button className="fab" aria-label="Registro rápido" onClick={() => openSheet({ kind: 'quick' })}>
        <Plus size={26} strokeWidth={2.4} />
      </button>

      <nav className="tabbar" aria-label="Navegação">
        {TABS.map((t) => {
          const b = badgeFor(t.path) || (t.path === '/planejar' ? badges.remindersDue : 0);
          return (
            <a key={t.path} href={'#' + t.path} className={cx('tab', isActive(t) && 'active')} aria-current={isActive(t) ? 'page' : undefined}>
              <span className="tab-icon">{t.icon}</span>
              {t.label}
              {b > 0 && <span className="tab-dot" />}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
