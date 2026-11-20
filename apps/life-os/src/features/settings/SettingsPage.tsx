import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing, CalendarPlus, Check, Database, Download, HardDrive, History, Info, Palette, Plus, RotateCcw, Share2, Smartphone, Trash2, Upload, User, CalendarDays, Bell, Tag,
} from 'lucide-react';
import { ACCENT_KEYS, type AccentKey, type AppData } from '../../core/types';
import { nowLocal } from '../../core/date';
import { countsOf, getBackend, listSnapshots, readSnapshot, type SnapshotInfo } from '../../core/db';
import { normalizeData } from '../../core/defaults';
import { actions, getData, useData } from '../../store/store';
import { flushSave, requestPersistentStorage, snapshotNow } from '../../store/persistence';
import { confirmDialog, openSheet, toast, useUI } from '../../store/ui';
import { cx, Segmented, Switch, TileIcon } from '../../ui/components';
import { isIOS, isStandalone, notificationSupport, registerPeriodicCheck, requestNotificationPermission, sendTestNotification, type PermissionState } from '../../app/notify';
import { canShareFiles, downloadBackup, downloadIcs, parseBackup, shareBackup } from './backup';

const ACCENT_LABEL: Record<AccentKey, string> = { lime: 'Lima', violet: 'Violeta', blue: 'Azul', aqua: 'Verde-água', orange: 'Laranja' };
const ACCENT_SWATCH: Record<AccentKey, string> = { lime: '#c5f26b', violet: '#a99bff', blue: '#7ab4ff', aqua: '#5ee0b5', orange: '#ffa06b' };

export default function SettingsPage() {
  return (
    <div className="page page-narrow">
      <div className="page-head">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-sub">Personalize o LIFE OS e cuide dos seus dados.</p>
        </div>
      </div>
      <div className="stack" style={{ '--gap': '16px' } as React.CSSProperties}>
        <ProfileSection />
        <AppearanceSection />
        <AreasSection />
        <NotificationsSection />
        <InstallSection />
        <DataSection />
        <AboutSection />
      </div>
    </div>
  );
}

function SectionHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="card-head">
      <span className="tile-icon tile-icon-sm hue-slate">{icon}</span>
      <div>
        <div className="card-title">{title}</div>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
    </div>
  );
}

function ProfileSection() {
  const s = useData().settings;
  const [name, setName] = useState(s.name);
  return (
    <section className="card">
      <SectionHead icon={<User size={16} />} title="Perfil" />
      <label className="field">
        <span className="field-label">Seu nome</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => actions.updateSettings({ name: name.trim() })} placeholder="Como quer ser chamado" maxLength={40} />
      </label>
    </section>
  );
}

function AppearanceSection() {
  const s = useData().settings;
  return (
    <section className="card">
      <SectionHead icon={<Palette size={16} />} title="Aparência e semana" />
      <div className="setting-row">
        <div className="setting-text">
          <div className="setting-title">Tema</div>
        </div>
        <Segmented
          size="sm"
          value={s.theme}
          onChange={(v) => actions.updateSettings({ theme: v })}
          options={[
            { value: 'dark', label: 'Escuro' },
            { value: 'light', label: 'Claro' },
            { value: 'system', label: 'Sistema' },
          ]}
        />
      </div>
      <div className="setting-row">
        <div className="setting-text">
          <div className="setting-title">Cor de destaque</div>
          <div className="setting-desc">{ACCENT_LABEL[s.accent]}</div>
        </div>
        <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
          {ACCENT_KEYS.map((a) => (
            <button
              key={a}
              className={cx('swatch', s.accent === a && 'on')}
              style={{ '--hue': ACCENT_SWATCH[a], width: 28, height: 28 } as React.CSSProperties}
              aria-label={ACCENT_LABEL[a]}
              aria-pressed={s.accent === a}
              onClick={() => actions.updateSettings({ accent: a })}
            >
              {s.accent === a && <Check size={14} color="#111" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-text">
          <div className="setting-title">Início da semana</div>
          <div className="setting-desc">Define o período das metas semanais. Registros são por dia e nunca se perdem.</div>
        </div>
        <Segmented<'1' | '0'>
          size="sm"
          value={String(s.weekStartsOn) as '1' | '0'}
          onChange={async (v) => {
            const next = Number(v) as 0 | 1;
            if (next === s.weekStartsOn) return;
            const ok = await confirmDialog({
              title: 'Mudar o início da semana?',
              message: 'Seus registros diários continuam intactos, mas as semanas passarão a ser contadas a partir do novo dia. Metas personalizadas de semanas antigas podem deixar de corresponder.',
              confirmLabel: 'Mudar',
            });
            if (ok) actions.updateSettings({ weekStartsOn: next });
          }}
          options={[
            { value: '1', label: 'Segunda' },
            { value: '0', label: 'Domingo' },
          ]}
        />
      </div>
    </section>
  );
}

function AreasSection() {
  const data = useData();
  const areas = Object.values(data.areas).sort((a, b) => a.order - b.order);
  const usage = (id: string) => Object.values(data.habits).filter((h) => h.areaId === id && !h.archived).length;
  return (
    <section className="card">
      <div className="card-head">
        <span className="tile-icon tile-icon-sm hue-slate">
          <Tag size={16} />
        </span>
        <div>
          <div className="card-title">Áreas da vida e categorias</div>
          <div className="card-sub">Organizam hábitos, tarefas, lembretes e a cor dos compromissos</div>
        </div>
      </div>
      <div className="list">
        {areas.map((a) => (
          <button key={a.id} className="list-row clickable" onClick={() => openSheet({ kind: 'area', id: a.id })}>
            <TileIcon icon={a.icon} color={a.color} size="sm" />
            <span className="list-row-main" style={{ textAlign: 'left' }}>
              <span className="list-row-title">{a.name}</span>
              <span className="list-row-sub">
                {usage(a.id)} hábito{usage(a.id) === 1 ? '' : 's'}
              </span>
            </span>
            <span className="faint" style={{ fontSize: 13 }}>
              Editar
            </span>
          </button>
        ))}
      </div>
      <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => openSheet({ kind: 'area' })}>
        <Plus size={15} /> Nova categoria
      </button>
      <div className="row" style={{ marginTop: 10 }}>
        <a className="link" href="#/faculdade?v=disciplinas" style={{ fontSize: 13.5 }}>
          Gerenciar disciplinas da faculdade →
        </a>
      </div>
    </section>
  );
}

function NotificationsSection() {
  const data = useData();
  const prefs = data.settings.notifications;
  const [perm, setPerm] = useState<PermissionState>(notificationSupport());
  const [bg, setBg] = useState<string | null>(null);
  const swOk = 'serviceWorker' in navigator;

  useEffect(() => {
    if (perm === 'granted') registerPeriodicCheck().then(setBg);
  }, [perm]);

  const permLabel: Record<PermissionState, { text: string; cls: string }> = {
    granted: { text: 'Ativadas', cls: 'badge-success' },
    denied: { text: 'Bloqueadas', cls: 'badge-danger' },
    default: { text: 'Não ativadas', cls: 'badge-warning' },
    unsupported: { text: 'Indisponíveis', cls: '' },
  };

  return (
    <section className="card">
      <div className="card-head">
        <span className="tile-icon tile-icon-sm hue-slate">
          <BellRing size={16} />
        </span>
        <div style={{ flex: 1 }}>
          <div className="card-title">Notificações</div>
          <div className="card-sub">Lembretes, prazos, hábitos e compromissos</div>
        </div>
        <span className={cx('badge', permLabel[perm].cls)}>{permLabel[perm].text}</span>
      </div>

      <div className="row wrap" style={{ marginBottom: 6 }}>
        {perm === 'default' && (
          <button className="btn btn-accent btn-sm" onClick={async () => setPerm(await requestNotificationPermission())}>
            Ativar notificações
          </button>
        )}
        {perm === 'granted' && (
          <button
            className="btn btn-outline btn-sm"
            onClick={async () => {
              const ok = await sendTestNotification();
              toast(ok ? 'Notificação de teste enviada' : 'Não foi possível enviar', { tone: ok ? 'success' : 'danger' });
            }}
          >
            Enviar notificação de teste
          </button>
        )}
        {perm === 'denied' && <span className="muted" style={{ fontSize: 13 }}>Libere nas configurações do navegador (cadeado ao lado do endereço) e recarregue.</span>}
        {perm === 'unsupported' && <span className="muted" style={{ fontSize: 13 }}>{isIOS() && !isStandalone() ? 'No iPhone, instale o app na tela inicial para ativar.' : 'Este navegador não oferece notificações.'}</span>}
      </div>

      {(
        [
          ['reminders', 'Lembretes', 'No horário de cada lembrete', <Bell size={15} key="b" />],
          ['academic', 'Prazos da faculdade', 'Conforme os avisos de cada atividade', null],
          ['habits', 'Hábitos com horário', 'Só se ainda não foram feitos', null],
          ['events', 'Compromissos', 'Com a antecedência escolhida', null],
          ['tasks', 'Tarefas com horário', 'No horário da tarefa', null],
        ] as const
      ).map(([k, title, desc]) => (
        <div className="setting-row" key={k}>
          <div className="setting-text">
            <div className="setting-title">{title}</div>
            <div className="setting-desc">{desc}</div>
          </div>
          <Switch on={prefs[k]} onChange={(v) => actions.updateNotificationPrefs({ [k]: v })} label={title} />
        </div>
      ))}
      <div className="setting-row">
        <div className="setting-text">
          <div className="setting-title">Horário dos avisos de prazo</div>
          <div className="setting-desc">Para trabalhos e provas</div>
        </div>
        <input className="input" type="time" style={{ width: 120 }} value={prefs.academicTime} onChange={(e) => e.target.value && actions.updateNotificationPrefs({ academicTime: e.target.value })} />
      </div>

      <div className="notice" style={{ marginTop: 14 }}>
        <Info size={18} style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <strong>Como os avisos funcionam.</strong> O LIFE OS envia notificações reais do sistema enquanto o app está aberto ou em segundo plano (aba ou app recente).
          {' '}Com o app <strong>totalmente fechado</strong>, navegadores não permitem agendar notificações locais sem um servidor de push: no Chrome/Android com o app instalado, o LIFE OS pede ao sistema verificações periódicas{bg === 'registered' ? ' (ativo neste aparelho)' : ''}, mas o intervalo é decidido pelo navegador. No iPhone, as notificações exigem o app instalado na tela inicial (iOS 16.4+).
          {' '}Ao abrir o app, tudo o que venceu aparece destacado. <strong>Para garantia total</strong>, exporte prazos e lembretes para o calendário do celular — ele avisa mesmo com tudo fechado.
          <div className="faint" style={{ marginTop: 6, fontSize: 12 }}>
            Service worker: {swOk ? 'ativo' : 'indisponível'} · Verificação em segundo plano: {bg === 'registered' ? 'registrada' : bg === 'denied' ? 'não permitida pelo navegador' : 'não suportada neste navegador'}
          </div>
        </div>
      </div>
      <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => downloadIcs(getData(), 'lifeos-agenda')}>
        <CalendarPlus size={15} /> Exportar agenda para o calendário (.ics)
      </button>
    </section>
  );
}

function InstallSection() {
  const prompt = useUI((s) => s.installPrompt);
  const standalone = isStandalone();
  return (
    <section className="card">
      <SectionHead icon={<Smartphone size={16} />} title="Instalar como app" sub={standalone ? 'Você está usando o app instalado' : 'Abre em tela cheia, funciona offline'} />
      {standalone ? (
        <p className="muted" style={{ fontSize: 13.5 }}>
          <Check size={15} style={{ verticalAlign: -3, color: 'var(--success)' }} /> Instalado. Os dados ficam neste aparelho.
        </p>
      ) : prompt ? (
        <button
          className="btn btn-accent btn-sm"
          onClick={async () => {
            await prompt.prompt();
            const r = await prompt.userChoice;
            if (r.outcome === 'accepted') useUI.setState({ installPrompt: null });
          }}
        >
          <Download size={15} /> Instalar LIFE OS
        </button>
      ) : isIOS() ? (
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}>
          No Safari, toque em <Share2 size={14} style={{ verticalAlign: -2 }} /> <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>.
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55 }}>
          No Chrome/Edge, use o ícone de instalação na barra de endereço ou o menu → <strong>Instalar app</strong>. No Android: menu ⋮ → <strong>Adicionar à tela inicial</strong>.
        </p>
      )}
    </section>
  );
}

function DataSection() {
  const data = useData();
  const counts = useMemo(() => countsOf(data), [data]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [snaps, setSnaps] = useState<SnapshotInfo[]>([]);
  const [storage, setStorage] = useState<{ persisted: boolean | null; usage?: number; quota?: number }>({ persisted: null });

  const refresh = () => {
    listSnapshots().then(setSnaps);
    (async () => {
      const persisted = navigator.storage?.persisted ? await navigator.storage.persisted().catch(() => null) : null;
      const est = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null;
      setStorage({ persisted, usage: est?.usage, quota: est?.quota });
    })();
  };
  useEffect(refresh, []);

  const replaceWith = async (next: AppData, label: string) => {
    await flushSave();
    await snapshotNow(`${nowLocal()}-${label}`);
    next.settings.onboarded = true;
    actions.replaceData(next);
    await flushSave();
    refresh();
  };

  const onImport = async (file: File) => {
    try {
      const next = await parseBackup(file);
      const c = countsOf(next);
      const ok = await confirmDialog({
        title: 'Restaurar este backup?',
        message: `O arquivo tem ${c.habits} hábitos, ${c.logs} registros, ${c.tasks} tarefas, ${c.academic} atividades acadêmicas, ${c.reminders} lembretes e ${c.events} compromissos. Os dados atuais serão substituídos — uma cópia automática deles fica guardada em “Backups automáticos”.`,
        confirmLabel: 'Restaurar',
      });
      if (!ok) return;
      await replaceWith(next, 'antes-de-importar');
      toast('Backup restaurado', { tone: 'success' });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Arquivo inválido', { tone: 'danger' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const restoreSnap = async (s: SnapshotInfo) => {
    const ok = await confirmDialog({ title: 'Restaurar este backup automático?', message: `Os dados voltarão ao estado salvo em ${new Date(s.savedAt).toLocaleString('pt-BR')}. O estado atual também é guardado antes.`, confirmLabel: 'Restaurar' });
    if (!ok) return;
    const raw = await readSnapshot(s.key);
    if (!raw) return toast('Backup não encontrado', { tone: 'danger' });
    await replaceWith(normalizeData(raw), 'antes-de-restaurar');
    toast('Dados restaurados', { tone: 'success' });
  };

  const reset = async () => {
    const ok = await confirmDialog({
      title: 'Apagar todos os dados?',
      message: 'Hábitos, registros, metas, tarefas, faculdade, lembretes e agenda serão apagados deste aparelho. Uma cópia fica em “Backups automáticos”, mas recomendamos exportar um backup antes.',
      confirmLabel: 'Apagar tudo',
      danger: true,
    });
    if (!ok) return;
    await flushSave();
    await snapshotNow(`${nowLocal()}-antes-de-apagar`);
    actions.resetData();
    toast('Dados apagados');
  };

  const fmtBytes = (n?: number) => (n === undefined ? '—' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
  const backend = getBackend();

  return (
    <section className="card">
      <SectionHead icon={<Database size={16} />} title="Dados e backup" sub="Salvamento automático neste aparelho" />

      <div className="data-counts">
        <span><b className="num">{counts.habits}</b> hábitos</span>
        <span><b className="num">{counts.logs}</b> registros</span>
        <span><b className="num">{counts.tasks}</b> tarefas</span>
        <span><b className="num">{counts.academic}</b> faculdade</span>
        <span><b className="num">{counts.reminders}</b> lembretes</span>
        <span><b className="num">{counts.events}</b> compromissos</span>
      </div>

      <div className="row wrap" style={{ marginTop: 14, '--gap': '8px' } as React.CSSProperties}>
        <button className="btn btn-primary btn-sm" onClick={() => downloadBackup(getData())}>
          <Download size={15} /> Exportar backup (JSON)
        </button>
        {canShareFiles() && (
          <button className="btn btn-outline btn-sm" onClick={() => shareBackup(getData())}>
            <Share2 size={15} /> Enviar para Drive/Arquivos
          </button>
        )}
        <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Restaurar backup
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </div>

      <div className="setting-row" style={{ marginTop: 14 }}>
        <HardDrive size={18} className="faint" />
        <div className="setting-text">
          <div className="setting-title">Armazenamento</div>
          <div className="setting-desc">
            {backend === 'indexeddb' ? 'Banco local (IndexedDB)' : backend === 'localstorage' ? 'Armazenamento local (modo compatível)' : 'Somente memória — os dados não serão salvos!'} · {fmtBytes(storage.usage)} usados ·{' '}
            {storage.persisted ? 'protegido contra limpeza automática' : 'o navegador pode limpar se faltar espaço'}
          </div>
        </div>
        {!storage.persisted && storage.persisted !== null && (
          <button
            className="btn btn-sm btn-outline"
            onClick={async () => {
              const r = await requestPersistentStorage();
              toast(r ? 'Armazenamento protegido' : 'O navegador não concedeu agora — instalar o app costuma liberar', { tone: r ? 'success' : 'default' });
              refresh();
            }}
          >
            Proteger
          </button>
        )}
      </div>

      <div className="section-label" style={{ marginTop: 14 }}>
        <History size={14} /> Backups automáticos (neste aparelho)
      </div>
      {snaps.length === 0 ? (
        <p className="faint" style={{ fontSize: 13 }}>O primeiro backup automático é criado hoje; um por dia, guardando os 10 mais recentes.</p>
      ) : (
        <div className="list">
          {snaps.map((s) => (
            <div key={s.key} className="list-row">
              <div className="list-row-main">
                <div className="list-row-title" style={{ fontSize: 14 }}>
                  {new Date(s.savedAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}
                  {s.key.includes('antes') && <span className="badge" style={{ marginLeft: 8 }}>{s.key.split('-antes-')[1] ? 'antes de ' + s.key.split('-antes-')[1].replace(/-/g, ' ') : 'segurança'}</span>}
                </div>
                <div className="list-row-sub">
                  {s.counts.habits} hábitos · {s.counts.logs} registros · {s.counts.tasks} tarefas · {s.counts.academic} faculdade
                </div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => restoreSnap(s)}>
                <RotateCcw size={14} /> Restaurar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="notice" style={{ marginTop: 14 }}>
        <CalendarDays size={18} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>
          Os dados ficam só neste navegador/aparelho. Para usar em outro dispositivo, exporte o backup e restaure lá. A estrutura já está pronta para sincronização em nuvem numa versão futura.
        </span>
      </div>

      <button className="btn btn-danger btn-sm" style={{ marginTop: 14 }} onClick={reset}>
        <Trash2 size={15} /> Apagar todos os dados
      </button>
    </section>
  );
}

function AboutSection() {
  return (
    <section className="card">
      <SectionHead icon={<Info size={16} />} title="Sobre" />
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
        LIFE OS {__APP_VERSION__} · esquema de dados v{getData().schemaVersion}. Funciona offline. Nenhum dado sai do seu aparelho.
      </p>
    </section>
  );
}
