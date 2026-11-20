import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { dismissToast, useUI } from '../store/ui';
import { Sheet } from '../ui/components';
import { DynIcon } from '../ui/icons';

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  if (!toasts.length) return null;
  return createPortal(
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.icon ? (
            <DynIcon name={t.icon} size={18} />
          ) : t.tone === 'success' ? (
            <CircleCheck size={18} />
          ) : t.tone === 'danger' ? (
            <CircleAlert size={18} />
          ) : null}
          <div className="toast-msg" onClick={() => dismissToast(t.id)}>
            {t.message}
          </div>
          {t.secondary && (
            <button
              className="btn"
              onClick={() => {
                t.secondary!.onClick();
                dismissToast(t.id);
              }}
            >
              {t.secondary.label}
            </button>
          )}
          {t.action && (
            <button
              className="btn toast-primary"
              onClick={() => {
                t.action!.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function ConfirmHost() {
  const c = useUI((s) => s.confirm);
  if (!c) return null;
  return (
    <Sheet
      title={c.title}
      onClose={() => c.resolve(false)}
      className="dialog"
      footer={
        <>
          <button className="btn btn-outline" onClick={() => c.resolve(false)}>
            {c.cancelLabel ?? 'Cancelar'}
          </button>
          <button className={c.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => c.resolve(true)} autoFocus>
            {c.confirmLabel ?? 'Confirmar'}
          </button>
        </>
      }
    >
      {c.message && <p className="muted" style={{ lineHeight: 1.55 }}>{c.message}</p>}
    </Sheet>
  );
}
