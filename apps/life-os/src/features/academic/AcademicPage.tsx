import { useMemo, useState } from 'react';
import { BookMarked, Check, ChevronLeft, ChevronRight, GraduationCap, Pencil, Plus } from 'lucide-react';
import { addDays, addMonths, countdownLabel, diffDays, endOfWeek, formatLongDate, formatMonthYear, startOfMonth, startOfWeek } from '../../core/date';
import { agendaBetween, agendaByDay } from '../../core/agenda';
import type { AcademicItem } from '../../core/types';
import { useData } from '../../store/store';
import { useToday } from '../../store/clock';
import { openSheet } from '../../store/ui';
import { cx, Empty, Segmented } from '../../ui/components';
import { PRIORITY_RANK } from '../../ui/labels';
import { MonthGrid } from '../agenda/MonthGrid';
import { AcademicCard } from './AcademicCard';
import { AgendaRow } from '../agenda/ItemRow';
import { useRoute } from '../../app/router';

type View = 'pendentes' | 'atrasadas' | 'provas' | 'concluidas' | 'calendario' | 'disciplinas';
type Sort = 'data' | 'materia' | 'prioridade';

export default function AcademicPage() {
  const data = useData();
  const today = useToday();
  const { query } = useRoute();
  const [view, setView] = useState<View>(() => (query.get('v') as View) || 'pendentes');
  const [sort, setSort] = useState<Sort>('data');
  const [subject, setSubject] = useState<string>('all');

  const all = useMemo(() => Object.values(data.academic), [data.academic]);
  const counts = useMemo(() => {
    const pending = all.filter((a) => a.status !== 'concluido');
    return {
      pendentes: pending.length,
      atrasadas: pending.filter((a) => a.date < today).length,
      provas: pending.filter((a) => a.type === 'prova' && a.date >= today).length,
      concluidas: all.length - pending.length,
      semana: pending.filter((a) => a.date >= today && a.date <= endOfWeek(startOfWeek(today, data.settings.weekStartsOn))).length,
    };
  }, [all, today, data.settings.weekStartsOn]);

  const subjects = useMemo(() => Object.values(data.subjects).sort((a, b) => a.name.localeCompare(b.name)), [data.subjects]);

  const filtered = useMemo(() => {
    let list = all;
    if (view === 'pendentes') list = list.filter((a) => a.status !== 'concluido');
    if (view === 'atrasadas') list = list.filter((a) => a.status !== 'concluido' && a.date < today);
    if (view === 'provas') list = list.filter((a) => a.type === 'prova' && a.status !== 'concluido' && a.date >= today);
    if (view === 'concluidas') list = list.filter((a) => a.status === 'concluido');
    if (subject !== 'all') list = list.filter((a) => (subject === 'none' ? !a.subjectId : a.subjectId === subject));
    const byDate = (a: AcademicItem, b: AcademicItem) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99');
    const sorted = [...list];
    if (view === 'concluidas') sorted.sort((a, b) => b.date.localeCompare(a.date));
    else if (sort === 'data') sorted.sort(byDate);
    else if (sort === 'prioridade') sorted.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDate(a, b));
    else sorted.sort((a, b) => subjName(a).localeCompare(subjName(b)) || byDate(a, b));
    return sorted;
    function subjName(a: AcademicItem) {
      return (a.subjectId && data.subjects[a.subjectId]?.name) || '~';
    }
  }, [all, view, subject, sort, today, data.subjects]);

  const groups = useMemo(() => {
    const out: Array<{ label: string; items: AcademicItem[] }> = [];
    const push = (label: string, it: AcademicItem) => {
      const g = out.find((x) => x.label === label);
      if (g) g.items.push(it);
      else out.push({ label, items: [it] });
    };
    const weekEnd = endOfWeek(startOfWeek(today, data.settings.weekStartsOn));
    for (const a of filtered) {
      if (view === 'concluidas') push('Concluídas', a);
      else if (sort === 'materia') push((a.subjectId && data.subjects[a.subjectId]?.name) || 'Sem disciplina', a);
      else if (sort === 'prioridade') push(a.priority === 'high' ? 'Prioridade alta' : a.priority === 'medium' ? 'Prioridade média' : 'Prioridade baixa', a);
      else {
        const d = diffDays(today, a.date);
        push(d < 0 ? 'Atrasadas' : d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : a.date <= weekEnd ? 'Esta semana' : d <= 14 ? 'Próximas 2 semanas' : 'Mais adiante', a);
      }
    }
    return out;
  }, [filtered, view, sort, today, data.subjects, data.settings.weekStartsOn]);

  const summary =
    all.length === 0
      ? 'Trabalhos, provas e prazos em um só lugar.'
      : [counts.atrasadas ? `${counts.atrasadas} atrasada${counts.atrasadas > 1 ? 's' : ''}` : null, `${counts.semana} nesta semana`, `${counts.provas} prova${counts.provas === 1 ? '' : 's'} pela frente`].filter(Boolean).join(' · ');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Faculdade</h1>
          <p className="page-sub">{summary}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => openSheet({ kind: 'academic', type: 'prova' })}>
            Nova prova
          </button>
          <button className="btn btn-primary" onClick={() => openSheet({ kind: 'academic' })}>
            <Plus size={17} /> Atividade
          </button>
        </div>
      </div>

      <div className="acad-tabs">
        <AcadTab active={view === 'pendentes'} onClick={() => setView('pendentes')} label="Pendentes" count={counts.pendentes} />
        <AcadTab active={view === 'atrasadas'} onClick={() => setView('atrasadas')} label="Atrasadas" count={counts.atrasadas} tone={counts.atrasadas ? 'danger' : undefined} />
        <AcadTab active={view === 'provas'} onClick={() => setView('provas')} label="Provas" count={counts.provas} />
        <AcadTab active={view === 'concluidas'} onClick={() => setView('concluidas')} label="Concluídas" count={counts.concluidas} />
        <AcadTab active={view === 'calendario'} onClick={() => setView('calendario')} label="Calendário" />
        <AcadTab active={view === 'disciplinas'} onClick={() => setView('disciplinas')} label="Disciplinas" count={subjects.length} />
      </div>

      {view === 'calendario' ? (
        <AcademicCalendar />
      ) : view === 'disciplinas' ? (
        <SubjectsView />
      ) : (
        <>
          {all.length > 0 && (
            <div className="acad-toolbar">
              {view !== 'concluidas' && (
                <Segmented<Sort>
                  value={sort}
                  onChange={setSort}
                  size="sm"
                  options={[
                    { value: 'data', label: 'Data' },
                    { value: 'materia', label: 'Matéria' },
                    { value: 'prioridade', label: 'Prioridade' },
                  ]}
                />
              )}
              {subjects.length > 0 && (
                <select className="select" style={{ minHeight: 36, height: 36, padding: '0 36px 0 12px', fontSize: 13.5, width: 'auto', maxWidth: 220 }} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filtrar por disciplina">
                  <option value="all">Todas as disciplinas</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="none">Sem disciplina</option>
                </select>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="card">
              {all.length === 0 ? (
                <Empty
                  icon={<GraduationCap size={24} />}
                  title="Nada cadastrado ainda"
                  text="Cadastre trabalhos, provas, apresentações e relatórios com data de entrega. O Ritmora avisa quando o prazo estiver chegando."
                  action={
                    <div className="row wrap" style={{ justifyContent: 'center' }}>
                      <button className="btn btn-outline" onClick={() => openSheet({ kind: 'subject' })}>
                        Adicionar disciplina
                      </button>
                      <button className="btn btn-accent" onClick={() => openSheet({ kind: 'academic' })}>
                        <Plus size={17} /> Nova atividade
                      </button>
                    </div>
                  }
                />
              ) : (
                <Empty small icon={<Check size={20} />} title={view === 'atrasadas' ? 'Nenhuma entrega atrasada' : view === 'provas' ? 'Nenhuma prova marcada' : view === 'concluidas' ? 'Nada concluído ainda' : 'Nada pela frente'} text={view === 'atrasadas' ? 'Tudo em dia. 👏' : undefined} />
              )}
            </div>
          ) : (
            <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
              {groups.map((g) => (
                <section key={g.label}>
                  <div className="section-label">
                    {g.label} <span className="chip-count">{g.items.length}</span>
                  </div>
                  <div className="acad-list">
                    {g.items.map((a) => (
                      <AcademicCard key={a.id} a={a} today={today} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AcadTab({ active, onClick, label, count, tone }: { active: boolean; onClick: () => void; label: string; count?: number; tone?: 'danger' }) {
  return (
    <button className={cx('acad-tab', active && 'active', tone === 'danger' && 'danger')} onClick={onClick} aria-pressed={active}>
      {label}
      {count !== undefined && <span className="acad-tab-count">{count}</span>}
    </button>
  );
}

function AcademicCalendar() {
  const data = useData();
  const today = useToday();
  const [month, setMonth] = useState(startOfMonth(today));
  const [selected, setSelected] = useState(today);
  const items = useMemo(() => agendaBetween(data, addDays(month, -7), addDays(addMonths(month, 1), 7), { event: false, task: false, reminder: false }), [data, month]);
  const byDay = useMemo(() => agendaByDay(items), [items]);
  const dayItems = byDay.get(selected) ?? [];
  return (
    <div className="agenda-layout">
      <div className="card">
        <div className="card-head">
          <button className="icon-btn icon-btn-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
            <ChevronLeft size={18} />
          </button>
          <div className="card-title" style={{ flex: 1, textAlign: 'center' }}>
            {formatMonthYear(month)}
          </div>
          <button className="icon-btn icon-btn-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
            <ChevronRight size={18} />
          </button>
        </div>
        <MonthGrid month={month} selected={selected} today={today} weekStartsOn={data.settings.weekStartsOn} byDay={byDay} onSelect={setSelected} />
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">{formatLongDate(selected)}</div>
          <button className="card-link" onClick={() => openSheet({ kind: 'academic', date: selected })}>
            <Plus size={14} /> Adicionar
          </button>
        </div>
        {dayItems.length === 0 ? <Empty small title="Nada neste dia" /> : <div className="timeline">{dayItems.map((it) => <AgendaRow key={it.key} item={it} />)}</div>}
      </div>
    </div>
  );
}

function SubjectsView() {
  const data = useData();
  const today = useToday();
  const subjects = Object.values(data.subjects).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Disciplinas</div>
        <button className="card-link" onClick={() => openSheet({ kind: 'subject' })}>
          <Plus size={14} /> Nova disciplina
        </button>
      </div>
      {subjects.length === 0 ? (
        <Empty small icon={<BookMarked size={20} />} title="Nenhuma disciplina" text="Cadastre suas matérias para organizar e colorir as atividades." />
      ) : (
        <div className="list">
          {subjects.map((s) => {
            const items = Object.values(data.academic).filter((a) => a.subjectId === s.id);
            const pending = items.filter((a) => a.status !== 'concluido');
            const next = pending.filter((a) => a.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
            return (
              <div key={s.id} className="list-row">
                <span className={cx('tile-icon tile-icon-sm', `hue-${s.color}`)}>
                  <BookMarked size={16} />
                </span>
                <div className="list-row-main">
                  <div className="list-row-title">{s.name}</div>
                  <div className="list-row-sub">
                    {s.professor && <span>{s.professor} ·</span>}
                    {pending.length} pendente{pending.length === 1 ? '' : 's'} · {items.length - pending.length} concluída{items.length - pending.length === 1 ? '' : 's'}
                    {next && <span>· próxima {countdownLabel(next.date, today).toLowerCase()}</span>}
                  </div>
                </div>
                <button className="icon-btn icon-btn-sm" aria-label={`Editar ${s.name}`} onClick={() => openSheet({ kind: 'subject', id: s.id })}>
                  <Pencil size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
