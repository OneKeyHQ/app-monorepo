import platformEnv from '@onekeyhq/shared/src/platformEnv';

const TRADING_VIEW_NATIVE_DEBUG_EVENT_LIMIT = 250;

export type ITradingViewNativeDebugEventLevel = 'error' | 'info' | 'warning';

export type ITradingViewNativeDebugEventDetails = Record<
  string,
  boolean | null | number | string | undefined
>;

export interface ITradingViewNativeDebugEvent {
  details?: ITradingViewNativeDebugEventDetails;
  id: number;
  level: ITradingViewNativeDebugEventLevel;
  name: string;
  timestamp: number;
}

type ITradingViewNativeDebugEventListener = () => void;

let debugEventSequence = 0;
let debugEvents: readonly ITradingViewNativeDebugEvent[] = [];
const debugEventListeners = new Set<ITradingViewNativeDebugEventListener>();

function isTradingViewNativeDebugLoggerEnabled() {
  return Boolean(platformEnv.isDev && platformEnv.isWeb);
}

function notifyTradingViewNativeDebugEventListeners() {
  debugEventListeners.forEach((listener) => listener());
}

export function emitTradingViewNativeDebugEvent({
  details,
  level = 'info',
  name,
}: {
  details?: ITradingViewNativeDebugEventDetails;
  level?: ITradingViewNativeDebugEventLevel;
  name: string;
}) {
  if (!isTradingViewNativeDebugLoggerEnabled()) {
    return;
  }

  debugEventSequence += 1;
  const nextEvent: ITradingViewNativeDebugEvent = {
    details,
    id: debugEventSequence,
    level,
    name,
    timestamp: Date.now(),
  };
  debugEvents = [...debugEvents, nextEvent].slice(
    -TRADING_VIEW_NATIVE_DEBUG_EVENT_LIMIT,
  );
  notifyTradingViewNativeDebugEventListeners();
}

export function getTradingViewNativeDebugEvents() {
  return debugEvents;
}

export function subscribeTradingViewNativeDebugEvents(
  listener: ITradingViewNativeDebugEventListener,
) {
  debugEventListeners.add(listener);
  return () => debugEventListeners.delete(listener);
}

export function clearTradingViewNativeDebugEvents() {
  if (!debugEvents.length) {
    return;
  }
  debugEvents = [];
  notifyTradingViewNativeDebugEventListeners();
}

export function getTradingViewNativeDebugErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
