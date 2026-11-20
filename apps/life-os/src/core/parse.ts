// Tiny natural-language parser for quick task entry.
// "Estudar cálculo 14h !"  →  { title: "Estudar cálculo", time: "14:00", priority: "high" }
// "Comprar pão amanhã 18:30" → date = tomorrow
import { addDays, type DateKey, type TimeStr } from './date';
import type { Priority } from './types';

export interface ParsedTask {
  title: string;
  time: TimeStr | null;
  priority: Priority | null;
  date: DateKey | null;
}

export function parseQuickTask(input: string, today: DateKey): ParsedTask {
  let text = ` ${input.trim()} `;
  let time: TimeStr | null = null;
  let priority: Priority | null = null;
  let date: DateKey | null = null;

  const timeRe = /\s(?:às\s|as\s)?([01]?\d|2[0-3])(?::([0-5]\d)|h([0-5]\d)?)(?=\s)/i;
  const m = text.match(timeRe);
  if (m) {
    const h = m[1].padStart(2, '0');
    const min = (m[2] ?? m[3] ?? '00').padStart(2, '0');
    time = `${h}:${min}`;
    text = text.replace(m[0], ' ');
  }

  const prioRe = /\s(!{1,3}|!alta|!media|!média|!baixa)(?=\s)/i;
  const p = text.match(prioRe);
  if (p) {
    const tok = p[1].toLowerCase();
    priority = tok === '!baixa' ? 'low' : tok === '!media' || tok === '!média' ? 'medium' : 'high';
    text = text.replace(p[0], ' ');
  }

  const dayRe = /\s(hoje|amanhã|amanha|depois de amanhã|depois de amanha)(?=\s)/i;
  const d = text.match(dayRe);
  if (d) {
    const tok = d[1].toLowerCase();
    date = tok === 'hoje' ? today : tok.startsWith('depois') ? addDays(today, 2) : addDays(today, 1);
    text = text.replace(d[0], ' ');
  }

  return { title: text.replace(/\s+/g, ' ').trim(), time, priority, date };
}
