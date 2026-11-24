import type { BrowserWindow } from 'electron';

export type ICreateMainWindow = (opts?: {
  isSoftRestart?: boolean;
}) => Promise<BrowserWindow | null>;

// Coalesce concurrent window creations into one in-flight promise: the
// recovery page, the tray and the renderer must all observe the same window.
export function createMainWindowFactory(
  createMainWindowImpl: ICreateMainWindow,
): ICreateMainWindow {
  let createMainWindowPromise: Promise<BrowserWindow | null> | null = null;
  return (opts) => {
    if (createMainWindowPromise) {
      return createMainWindowPromise;
    }
    const promise = createMainWindowImpl(opts).finally(() => {
      if (createMainWindowPromise === promise) {
        createMainWindowPromise = null;
      }
    });
    createMainWindowPromise = promise;
    return promise;
  };
}
