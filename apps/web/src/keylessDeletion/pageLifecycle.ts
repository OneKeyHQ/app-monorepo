import type { Root } from 'react-dom/client';

export function resetOnHistoryRestore(root: Root) {
  globalThis.addEventListener('pagehide', () => root.unmount(), { once: true });
  globalThis.addEventListener('pageshow', (event) => {
    if (event instanceof PageTransitionEvent && event.persisted) {
      globalThis.location.reload();
    }
  });
}
