import { closeSheet, useUI, type SheetSpec } from '../store/ui';
import { QuickSheet } from '../features/quick/QuickSheet';
import { HabitForm } from '../features/habits/HabitForm';
import { HabitDetail } from '../features/habits/HabitDetail';
import { HabitCountSheet } from '../features/habits/HabitCountSheet';
import { TaskForm } from '../features/planner/TaskForm';
import { ReminderForm } from '../features/reminders/ReminderForm';
import { SnoozeSheet } from '../features/reminders/SnoozeSheet';
import { AcademicForm } from '../features/academic/AcademicForm';
import { AcademicDetail } from '../features/academic/AcademicDetail';
import { SubjectForm } from '../features/academic/SubjectForm';
import { EventForm } from '../features/agenda/EventForm';
import { AddForDaySheet } from '../features/agenda/AddForDaySheet';
import { AreaForm } from '../features/settings/AreaForm';

function render(spec: SheetSpec & { key: number }, close: () => void) {
  switch (spec.kind) {
    case 'quick':
      return <QuickSheet onClose={close} />;
    case 'habit':
      return <HabitForm id={spec.id} defaults={spec.defaults} onClose={close} />;
    case 'habitDetail':
      return <HabitDetail id={spec.id} onClose={close} />;
    case 'habitCount':
      return <HabitCountSheet id={spec.id} date={spec.date} onClose={close} />;
    case 'task':
      return <TaskForm id={spec.id} date={spec.date} time={spec.time} onClose={close} />;
    case 'reminder':
      return <ReminderForm id={spec.id} date={spec.date} time={spec.time} onClose={close} />;
    case 'snooze':
      return <SnoozeSheet id={spec.id} onClose={close} />;
    case 'academic':
      return <AcademicForm id={spec.id} date={spec.date} type={spec.type} onClose={close} />;
    case 'academicDetail':
      return <AcademicDetail id={spec.id} onClose={close} />;
    case 'subject':
      return <SubjectForm id={spec.id} onCreated={spec.onCreated} onClose={close} />;
    case 'event':
      return <EventForm id={spec.id} date={spec.date} time={spec.time} onClose={close} />;
    case 'addForDay':
      return <AddForDaySheet date={spec.date} onClose={close} />;
    case 'area':
      return <AreaForm id={spec.id} onCreated={spec.onCreated} onClose={close} />;
  }
}

// Back button / back gesture closes the open sheet instead of leaving the screen.
// Each opened sheet pushes a same-URL history entry (no hashchange, so routing is unaffected).
let pushed = 0;
let ignorePop = 0;
let closingFromPop = false;
useUI.subscribe((s, p) => {
  const n = s.sheets.length;
  const m = p.sheets.length;
  if (n > m) {
    for (let i = m; i < n; i++) {
      history.pushState({ lifeosSheet: true }, '');
      pushed++;
    }
  } else if (n < m && !closingFromPop) {
    const k = Math.min(pushed, m - n);
    if (k > 0) {
      pushed -= k;
      ignorePop++;
      history.go(-k);
    }
  }
});
window.addEventListener('popstate', () => {
  if (ignorePop > 0) {
    ignorePop--;
    return;
  }
  if (pushed > 0 && useUI.getState().sheets.length > 0) {
    pushed--;
    closingFromPop = true;
    closeSheet();
    closingFromPop = false;
  }
});

export function SheetHost() {
  const sheets = useUI((s) => s.sheets);
  return <>{sheets.map((s) => <div key={s.key}>{render(s, () => closeSheet(s.key))}</div>)}</>;
}
