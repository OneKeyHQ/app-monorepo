// Extension service worker: tells code that runs things in the offscreen
// document when its port is gone. The background entry reports it
// (apps/ext/src/background/offscreenPortGuard.ts). That port only goes away
// when the offscreen document unloads or the service worker stops, and the
// offscreen document reloads itself a few seconds after it loses its port, so
// whatever it ran is gone, and requests sent over the old port get no answer.

type IListener = () => void;

const listeners = new Set<IListener>();

export function onOffscreenPortDisconnected(listener: IListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportOffscreenPortDisconnected() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[offscreenDocument] listener failed', error);
    }
  });
}
