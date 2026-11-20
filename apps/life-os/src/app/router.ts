import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
}

let current = parse();
const subs = new Set<() => void>();

window.addEventListener('hashchange', () => {
  current = parse();
  subs.forEach((fn) => fn());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => current,
  );
}

export function navigate(to: string, replace = false) {
  const target = '#' + (to.startsWith('/') ? to : '/' + to);
  if (location.hash === target) return;
  if (replace) {
    history.replaceState(null, '', target);
    current = parse();
    subs.forEach((fn) => fn());
  } else location.hash = target;
}
