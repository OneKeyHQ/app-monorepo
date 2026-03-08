import { isPerfMonitorEnabled } from './enabled';

type IPerfMarkEvent = {
  name: string;
  detail?: unknown;
  absoluteTime: number;
  timestamp: number;
};

type IPerfMarkGlobal = {
  __perfReporterReady?: boolean;
  __perfReportMark?: (data: { name: string; detail?: unknown }) => void;
  __perfMarkBuffer?: IPerfMarkEvent[];
  __perfMarkBufferDropped?: number;
};

function isPerfMarkEnabled(): boolean {
  return isPerfMonitorEnabled();
}

export function perfMark(name: string, detail?: any) {
  if (!name) return;
  if (!isPerfMarkEnabled()) return;
  const g = globalThis as unknown as IPerfMarkGlobal;
  if (typeof g.__perfReportMark === 'function') {
    g.__perfReportMark({ name, detail });
    return;
  }

  // Buffer marks until reporter hooks are installed.
  // Timeline primarily uses absoluteTime, so buffering is acceptable.
  if (!Array.isArray(g.__perfMarkBuffer)) {
    g.__perfMarkBuffer = [];
  }
  const MAX_BUFFER = 5000;
  if (
    Array.isArray(g.__perfMarkBuffer) &&
    g.__perfMarkBuffer.length >= MAX_BUFFER
  ) {
    g.__perfMarkBufferDropped = (g.__perfMarkBufferDropped ?? 0) + 1;
    return;
  }
  g.__perfMarkBuffer.push({
    name,
    detail,
    absoluteTime: Date.now(),
    timestamp:
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
        ? performance.now()
        : Date.now(),
  });
}

export default {
  perfMark,
};
