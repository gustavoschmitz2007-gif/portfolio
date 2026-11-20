import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Upload } from 'lucide-react';
import { HABIT_TEMPLATES } from '../../core/defaults';
import { startOfWeek, todayKey } from '../../core/date';
import { actions, getData } from '../../store/store';
import { requestPersistentStorage } from '../../store/persistence';
import { toast } from '../../store/ui';
import { cx, Segmented, TileIcon } from '../../ui/components';
import { BrandMark } from '../../app/Shell';
import { parseBackup } from '../settings/backup';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set(['Seguir a dieta', 'Academia', 'Cardio', 'Estudar a faculdade']));
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(1);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');

  const groups = useMemo(() => {
    const m = new Map<string, typeof HABIT_TEMPLATES>();
    for (const t of HABIT_TEMPLATES) m.set(t.area, [...(m.get(t.area) ?? []), t]);
    return [...m.entries()];
  }, []);

  const toggle = (n: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const finish = () => {
    const data = getData();
    const areaByName = new Map(Object.values(data.areas).map((a) => [a.name, a.id]));
    actions.updateSettings({ name: name.trim(), weekStartsOn, theme });
    for (const t of HABIT_TEMPLATES) {
      if (!picked.has(t.name)) continue;
      actions.addHabit({
        name: t.name,
        areaId: areaByName.get(t.area) ?? null,
        icon: t.icon,
        color: t.color,
        frequency: t.frequency,
        days: t.days,
        weeklyTarget: t.weeklyTarget,
        dailyTarget: t.dailyTarget ?? 1,
        unit: t.unit,
      });
    }
    actions.updateSettings({ onboarded: true });
    actions.ensureWeekPlan(startOfWeek(todayKey(), weekStartsOn));
    void requestPersistentStorage();
    location.hash = '#/';
  };

  const importBackup = async (file: File) => {
    try {
      const data = await parseBackup(file);
      data.settings.onboarded = true;
      actions.replaceData(data);
      toast('Backup restaurado', { tone: 'success' });
      void requestPersistentStorage();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível ler o arquivo', { tone: 'danger' });
    }
  };

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="onb-progress">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cx(i <= step && 'on')} />
          ))}
        </div>

        {step === 0 && (
          <div className="onb-step">
            <div className="brand" style={{ padding: 0 }}>
              <BrandMark size={18} />
              <div className="brand-name">
                LIFE <span>OS</span>
              </div>
            </div>
            <h1 className="onb-title">Seu centro pessoal de organização.</h1>
            <p className="muted onb-text">Hábitos, metas da semana, faculdade, agenda e lembretes em um só lugar. Tudo fica salvo neste dispositivo, com backup quando você quiser.</p>
            <label className="field" style={{ marginTop: 8 }}>
              <span className="field-label">Como você quer ser chamado?</span>
              <input className="input input-lg" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" autoFocus maxLength={40} onKeyDown={(e) => e.key === 'Enter' && setStep(1)} />
            </label>
            <div className="onb-actions">
              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                <Upload size={16} /> Restaurar backup
                <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
              </label>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(1)}>
                Continuar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onb-step">
            <h1 className="onb-title">Escolha seus hábitos</h1>
            <p className="muted onb-text">Comece com alguns. Você pode editar metas, dias, ícones e cores — ou criar outros — a qualquer momento.</p>
            <div className="onb-habits">
              {groups.map(([area, list]) => (
                <div key={area}>
                  <div className="section-label">{area}</div>
                  <div className="onb-habit-grid">
                    {list.map((t) => {
                      const on = picked.has(t.name);
                      return (
                        <button key={t.name} className={cx('onb-habit', on && 'on')} onClick={() => toggle(t.name)} aria-pressed={on}>
                          <TileIcon icon={t.icon} color={t.color} size="sm" />
                          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                            <span className="onb-habit-name">{t.name}</span>
                            <span className="onb-habit-sub">{t.frequency === 'weekly' ? `${t.weeklyTarget}× por semana` : t.days.length === 7 ? (t.dailyTarget ? `${t.dailyTarget} ${t.unit} por dia` : 'Todos os dias') : 'Seg a sex'}</span>
                          </span>
                          <span className={cx('check', on && 'on')} aria-hidden="true">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="onb-actions">
              <button className="btn btn-ghost" onClick={() => setStep(0)}>
                <ArrowLeft size={16} /> Voltar
              </button>
              <button className="btn btn-primary btn-lg" onClick={() => setStep(2)}>
                {picked.size ? `Continuar com ${picked.size}` : 'Pular'} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onb-step">
            <h1 className="onb-title">Últimos ajustes</h1>
            <p className="muted onb-text">As metas semanais usam um período fixo, para que uma semana nunca se misture com a outra.</p>
            <div className="field">
              <span className="field-label">A semana começa na</span>
              <Segmented<'1' | '0'> block value={String(weekStartsOn) as '1' | '0'} onChange={(v) => setWeekStartsOn(Number(v) as 0 | 1)} options={[{ value: '1', label: 'Segunda-feira' }, { value: '0', label: 'Domingo' }]} />
            </div>
            <div className="field">
              <span className="field-label">Aparência</span>
              <Segmented
                block
                value={theme}
                onChange={(v) => {
                  setTheme(v);
                  actions.updateSettings({ theme: v });
                }}
                options={[
                  { value: 'dark', label: 'Escuro' },
                  { value: 'light', label: 'Claro' },
                  { value: 'system', label: 'Sistema' },
                ]}
              />
            </div>
            <div className="notice">
              <span>
                <strong>Seus dados ficam neste dispositivo</strong>, salvos automaticamente. Em Configurações você pode exportar um backup (JSON) e restaurá-lo em outro aparelho.
              </span>
            </div>
            <div className="onb-actions">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                <ArrowLeft size={16} /> Voltar
              </button>
              <button className="btn btn-accent btn-lg" onClick={finish}>
                Começar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
