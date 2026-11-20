import { create } from 'zustand';
import { nowLocal, todayKey, type DateKey, type LocalDateTime } from '../core/date';

interface Clock {
  today: DateKey;
  minute: LocalDateTime;
}

export const useClock = create<Clock>()(() => ({ today: todayKey(), minute: nowLocal() }));

export const useToday = () => useClock((s) => s.today);
export const useMinute = () => useClock((s) => s.minute);

const listeners = new Set<(today: DateKey) => void>();
export const onDayChange = (fn: (today: DateKey) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function startClock() {
  const tick = () => {
    const today = todayKey();
    const minute = nowLocal();
    const prev = useClock.getState();
    if (prev.minute !== minute || prev.today !== today) useClock.setState({ today, minute });
    if (prev.today !== today) listeners.forEach((fn) => fn(today));
  };
  setInterval(tick, 15000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && tick());
  window.addEventListener('focus', tick);
}
