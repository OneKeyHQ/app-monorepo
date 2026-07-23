import { useSyncExternalStore } from 'react';

type IMobileHomeRendererMode = 'native' | 'react';

const listeners = new Set<() => void>();
let rendererMode: IMobileHomeRendererMode = 'native';
let installed = false;

declare global {
  // eslint-disable-next-line no-var
  var __ONEKEY_HOME_RENDERER__: IMobileHomeRendererMode | undefined;
}

function isRendererMode(value: unknown): value is IMobileHomeRendererMode {
  return value === 'native' || value === 'react';
}

function setMobileHomeRendererMode(value: IMobileHomeRendererMode) {
  if (rendererMode === value) {
    return;
  }
  rendererMode = value;
  listeners.forEach((listener) => listener());
}

function installMobileHomeRendererDevSwitch() {
  if (installed || process.env.NODE_ENV === 'production') {
    return;
  }
  installed = true;
  const initialMode = globalThis.__ONEKEY_HOME_RENDERER__;
  if (isRendererMode(initialMode)) {
    rendererMode = initialMode;
  }
  Object.defineProperty(globalThis, '__ONEKEY_HOME_RENDERER__', {
    configurable: true,
    enumerable: false,
    get: () => rendererMode,
    set: (value: unknown) => {
      if (isRendererMode(value)) {
        setMobileHomeRendererMode(value);
      }
    },
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMobileHomeRendererMode(): IMobileHomeRendererMode {
  installMobileHomeRendererDevSwitch();
  return useSyncExternalStore(
    subscribe,
    () => rendererMode,
    () => 'native',
  );
}

export { setMobileHomeRendererMode };
export type { IMobileHomeRendererMode };
