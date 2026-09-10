import { useCallback, useId, useLayoutEffect, useRef } from 'react';

import loggerUtils from '@onekeyhq/shared/src/logger/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { LayoutChangeEvent } from 'react-native';

type ITraceState = Record<string, string | number | boolean | undefined>;

const startedAt = performance.now();
let sequence = 0;
let pending: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function writeTrace(batch: string) {
  try {
    loggerUtils.consoleFunc(batch);
  } catch {
    // Keep a failed native logger write out of the UI error boundary.
  }
}

function flushTrace() {
  flushTimer = undefined;
  const lines = pending;
  pending = [];
  // Keep each native write below the logger's 4096-character limit.
  let batch = '';
  for (const line of lines) {
    if (batch.length + line.length > 3000) {
      writeTrace(batch);
      batch = '';
    }
    batch += `${line}\n`;
  }
  if (batch) writeTrace(batch);
}

export function debugDeviceFlicker(event: string, state: ITraceState = {}) {
  if (!platformEnv.isNative || !platformEnv.isDev) return;
  // Temporary physical-device diagnostics; disabled in production.
  try {
    sequence += 1;
    pending.push(
      `[DEVICE-FLICKER] ${JSON.stringify({
        seq: sequence,
        epochMs: Date.now(),
        ms: Math.round((performance.now() - startedAt) * 10) / 10,
        runtime: 'main',
        event,
        ...state,
      })}`,
    );
    if (!flushTimer) {
      flushTimer = setTimeout(flushTrace, 100);
    }
  } catch {
    // Diagnostic failures must not affect navigation or device settings.
  }
}

export function useDeviceFlickerTrace(name: string, state: ITraceState = {}) {
  const instance = useId();
  const commits = useRef(0);
  const trace = useCallback(
    (event: string, values: ITraceState = {}) => {
      debugDeviceFlicker(event, { name, instance, ...values });
    },
    [instance, name],
  );

  useLayoutEffect(() => {
    trace('mount');
    return () => trace('unmount', { commits: commits.current });
  }, [trace]);

  useLayoutEffect(() => {
    commits.current += 1;
    trace('commit', { commit: commits.current, ...state });
  });

  const onLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      trace('layout', {
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
      });
    },
    [trace],
  );

  return { instance, trace, onLayout };
}
