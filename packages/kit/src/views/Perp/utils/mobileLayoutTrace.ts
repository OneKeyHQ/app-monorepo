import {
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

const PERPS_MOBILE_LAYOUT_TRACE_PREFIX = '[PerpsMobileLayoutTrace]';

export type IPerpsMobileLayoutTraceDetail = Record<string, unknown>;

export type IPerpsMobileLayoutTraceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function roundLayoutValue(value: number) {
  return Math.round(value * 100) / 100;
}

export function getPerpsMobileLayoutTraceRect(
  event: LayoutChangeEvent,
): IPerpsMobileLayoutTraceRect {
  const { x, y, width, height } = event.nativeEvent.layout;
  return {
    x: roundLayoutValue(x),
    y: roundLayoutValue(y),
    width: roundLayoutValue(width),
    height: roundLayoutValue(height),
  };
}

export function isPerpsMobileLayoutTraceRectChanged(
  prev: IPerpsMobileLayoutTraceRect | undefined,
  next: IPerpsMobileLayoutTraceRect,
  threshold = 0.5,
) {
  if (!prev) {
    return true;
  }
  return (
    Math.abs(prev.x - next.x) > threshold ||
    Math.abs(prev.y - next.y) > threshold ||
    Math.abs(prev.width - next.width) > threshold ||
    Math.abs(prev.height - next.height) > threshold
  );
}

export function isPerpsMobileLayoutTraceEnabled() {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return (
    process.env.PERF_MONITOR_ENABLED === '1' ||
    process.env.PERPS_MOBILE_LAYOUT_TRACE === '1'
  );
}

export function tracePerpsMobileLayout(
  label: string,
  detail?: IPerpsMobileLayoutTraceDetail,
) {
  if (!isPerpsMobileLayoutTraceEnabled()) {
    return;
  }
  const payload = detail ?? {};
  console.log(PERPS_MOBILE_LAYOUT_TRACE_PREFIX, label, payload);

  if (!platformEnv.isNative) {
    return;
  }

  try {
    NativeLogger.write(
      LogLevel.Info,
      `${PERPS_MOBILE_LAYOUT_TRACE_PREFIX} ${label} ${JSON.stringify(payload)}`,
    );
  } catch {
    // Keep layout tracing diagnostic-only; never let logger availability affect UI.
  }
}
