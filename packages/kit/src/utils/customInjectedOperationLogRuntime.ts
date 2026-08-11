import type { ICustomInjectedOperationLogRecord } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

type ICustomInjectedOperationLogCursorListener = (cursor: number) => void;

const performanceTimeOrigin = globalThis.performance?.timeOrigin;
let customInjectedOperationLogAppStartedAt =
  typeof performanceTimeOrigin === 'number' &&
  Number.isFinite(performanceTimeOrigin)
    ? performanceTimeOrigin
    : Date.now();

const cursorListeners = new Map<
  string,
  Set<ICustomInjectedOperationLogCursorListener>
>();
const visibleAfterBySession = new Map<string, number>();
const errorAcknowledgedAtBySession = new Map<string, number>();

export function setCustomInjectedOperationLogAppStartedAt(
  cursor: number,
): void {
  if (Number.isFinite(cursor) && cursor > 0) {
    customInjectedOperationLogAppStartedAt = cursor;
  }
}

export function isCustomInjectedOperationLogError(
  record: ICustomInjectedOperationLogRecord,
): boolean {
  if (record.status === 'error') return true;
  if (record.status !== 'result' || !record.result) return false;
  return record.result.passed === false;
}

export function getCustomInjectedOperationLogVisibleAfter(
  sessionId: string,
): number {
  return visibleAfterBySession.get(sessionId) ?? 0;
}

export function getCustomInjectedOperationLogErrorAcknowledgedAt(
  sessionId: string,
): number {
  return (
    errorAcknowledgedAtBySession.get(sessionId) ??
    customInjectedOperationLogAppStartedAt
  );
}

export function setCustomInjectedOperationLogVisibleAfter(
  sessionId: string,
  cursor = Date.now(),
): void {
  visibleAfterBySession.set(sessionId, cursor);
  errorAcknowledgedAtBySession.set(sessionId, cursor);
  cursorListeners.get(sessionId)?.forEach((listener) => listener(cursor));
}

export function subscribeCustomInjectedOperationLogErrorAcknowledgement(
  sessionId: string,
  listener: ICustomInjectedOperationLogCursorListener,
): () => void {
  const listeners = cursorListeners.get(sessionId) || new Set();
  listeners.add(listener);
  cursorListeners.set(sessionId, listeners);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) cursorListeners.delete(sessionId);
  };
}
