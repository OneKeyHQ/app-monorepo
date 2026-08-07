import type {
  ICustomInjectedProtocol,
  ICustomInjectedSession,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { ICustomInjectedProtocolRuntimeScope } from './customInjectedProtocolRuntime';

type IListener = (session: ICustomInjectedSession | undefined) => void;
type IProtocolSelectionListener = (
  protocol: ICustomInjectedProtocol,
  session: ICustomInjectedSession,
  options?: { lockToken?: string },
) => ICustomInjectedProtocolRuntimeScope | undefined;

let activeSession: ICustomInjectedSession | undefined;
const listeners = new Set<IListener>();
const protocolSelectionListeners = new Set<IProtocolSelectionListener>();
let sessionUpdateQueue: Promise<void> = Promise.resolve();

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

export function requestCustomInjectedProtocolSelection(
  protocol: ICustomInjectedProtocol,
  session: ICustomInjectedSession,
  options?: { lockToken?: string },
) {
  let selectedScope: ICustomInjectedProtocolRuntimeScope | undefined;
  protocolSelectionListeners.forEach((listener) => {
    selectedScope = listener(protocol, session, options) ?? selectedScope;
  });
  return selectedScope;
}

export function subscribeCustomInjectedProtocolSelection(
  listener: IProtocolSelectionListener,
) {
  protocolSelectionListeners.add(listener);
  return () => {
    protocolSelectionListeners.delete(listener);
  };
}

function enqueueSessionUpdate<T>(task: () => Promise<T>): Promise<T> {
  const result = sessionUpdateQueue.then(task, task);
  sessionUpdateQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function activateCustomInjectedWorkspace({
  customInjectionEnabled,
  workspace,
  devSettingsEnabled,
}: {
  customInjectionEnabled: boolean;
  workspace: string;
  devSettingsEnabled: boolean;
}): Promise<ICustomInjectedSession> {
  return enqueueSessionUpdate(async () => {
    if (!devSettingsEnabled || !customInjectionEnabled) {
      throw new OneKeyLocalError(
        'Custom injection requires enabled developer settings and the Custom Injection switch',
      );
    }
    if (activeSession?.workspace === workspace) {
      try {
        const refreshed =
          await globalThis.desktopApiProxy.webview.getCustomInjectedWorkspace(
            activeSession.sessionId,
          );
        setActiveCustomInjectedWorkspace(refreshed);
        return refreshed;
      } catch {
        setActiveCustomInjectedWorkspace(undefined);
      }
    }
    const preview =
      await globalThis.desktopApiProxy.webview.prepareCustomInjectedWorkspace(
        workspace,
        devSettingsEnabled,
      );
    try {
      const session =
        await globalThis.desktopApiProxy.webview.activateCustomInjectedWorkspace(
          preview.sessionId,
        );
      setActiveCustomInjectedWorkspace(session);
      return session;
    } catch (error) {
      await globalThis.desktopApiProxy.webview
        .closeCustomInjectedWorkspace(preview.sessionId)
        .catch(() => undefined);
      throw error;
    }
  });
}

export async function deactivateCustomInjectedWorkspace(): Promise<void> {
  return enqueueSessionUpdate(async () => {
    const runtimeSession = activeSession;
    const desktopSession = await globalThis.desktopApiProxy.webview
      .getActiveCustomInjectedWorkspace()
      .catch(() => null);
    const sessionId = runtimeSession?.sessionId || desktopSession?.sessionId;
    if (sessionId) {
      await globalThis.desktopApiProxy.webview
        .closeCustomInjectedWorkspace(sessionId)
        .catch(() => undefined);
    }
    setActiveCustomInjectedWorkspace(undefined);
  });
}
