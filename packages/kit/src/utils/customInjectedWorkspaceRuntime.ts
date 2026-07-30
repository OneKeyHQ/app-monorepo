import type { ICustomInjectedSession } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

type IListener = (session: ICustomInjectedSession | undefined) => void;

let activeSession: ICustomInjectedSession | undefined;
const listeners = new Set<IListener>();

export function getActiveCustomInjectedWorkspace() {
  return activeSession;
}

export function setActiveCustomInjectedWorkspace(
  session: ICustomInjectedSession | undefined,
) {
  activeSession = session;
  listeners.forEach((listener) => listener(session));
}

export function subscribeActiveCustomInjectedWorkspace(listener: IListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
