import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/pages.css';
import { App } from './app/App';
import { hydrate } from './store/persistence';
import { startClock } from './store/clock';
import { handleNotificationAction, startNotificationLoop } from './app/notify';
import { openSheet, toast, useUI, type BeforeInstallPromptEvent } from './store/ui';

async function boot() {
  await hydrate();
  startClock();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  document.getElementById('splash')?.remove();

  startNotificationLoop();

  // Actions coming from a notification click when the app was closed.
  const params = new URLSearchParams(location.search);
  const na = params.get('na');
  if (na) {
    handleNotificationAction(na, params.get('k') ?? '', params.get('id') ?? '');
    history.replaceState(null, '', location.pathname + location.hash);
  }
  // Home screen shortcut: open quick log.
  if (location.hash.includes('quick=1')) {
    openSheet({ kind: 'quick' });
    history.replaceState(null, '', location.pathname + '#/');
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    useUI.setState({ installPrompt: e as BeforeInstallPromptEvent });
  });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register');
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        useUI.setState({ updateReady: () => update(true) });
        toast('Nova versão do Ritmora disponível', { duration: 0, action: { label: 'Atualizar', onClick: () => update(true) } });
      },
    });
  }
}

void boot();
