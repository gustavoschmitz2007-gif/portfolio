import { useState } from 'react';
import { BellOff, BellRing, Smartphone, X } from 'lucide-react';
import { isIOS, isStandalone, notificationSupport, requestNotificationPermission, sendTestNotification, type PermissionState } from '../../app/notify';
import { toast } from '../../store/ui';

const DISMISS_KEY = 'lifeos:notif-dismissed';

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Contextual card asking for notification permission (explains first, then asks). */
export function NotificationNotice({ dismissible, compact }: { dismissible?: boolean; compact?: boolean }) {
  const [perm, setPerm] = useState<PermissionState>(notificationSupport());
  const [dismissed, setDismissed] = useState(readDismissed);
  if (perm === 'granted') return null;
  if (dismissible && dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  if (perm === 'unsupported' || (isIOS() && !isStandalone())) {
    return (
      <div className="notice notice-warning">
        <Smartphone size={18} style={{ marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          {isIOS() ? (
            <>
              <strong>No iPhone, as notificações exigem o app instalado.</strong> Toque em Compartilhar → “Adicionar à Tela de Início”, abra o LIFE OS por lá e ative os avisos (iOS 16.4 ou superior).
            </>
          ) : (
            <>
              <strong>Este navegador não oferece notificações.</strong> Os lembretes continuam aparecendo aqui no app. Para alertas no celular, exporte para o calendário (.ics) em Configurações.
            </>
          )}
        </div>
        {dismissible && (
          <button className="icon-btn icon-btn-sm" onClick={dismiss} aria-label="Dispensar">
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  if (perm === 'denied') {
    return (
      <div className="notice notice-danger">
        <BellOff size={18} style={{ marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <strong>Notificações bloqueadas.</strong> Para receber avisos, libere as notificações deste site nas configurações do navegador (ícone de cadeado ao lado do endereço) e recarregue a página.
        </div>
        {dismissible && (
          <button className="icon-btn icon-btn-sm" onClick={dismiss} aria-label="Dispensar">
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="notice notice-accent">
      <BellRing size={18} style={{ marginTop: 2, color: 'var(--accent-ink)' }} />
      <div style={{ flex: 1 }}>
        <strong>Ative as notificações</strong>
        {!compact && <> para ser avisado de lembretes, prazos da faculdade e hábitos com horário.</>}
        <div className="row" style={{ marginTop: 10, '--gap': '8px' } as React.CSSProperties}>
          <button
            className="btn btn-sm btn-accent"
            onClick={async () => {
              const res = await requestNotificationPermission();
              setPerm(res);
              if (res === 'granted') {
                toast('Notificações ativadas', { tone: 'success' });
                void sendTestNotification();
              }
            }}
          >
            Ativar notificações
          </button>
          {dismissible && (
            <button className="btn btn-sm btn-ghost" onClick={dismiss}>
              Agora não
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
