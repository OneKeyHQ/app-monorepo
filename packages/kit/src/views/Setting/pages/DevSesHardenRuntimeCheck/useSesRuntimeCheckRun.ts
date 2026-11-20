import { useCallback, useEffect, useRef, useState } from 'react';

import type { ISesRuntimeCheckReport } from '@onekeyhq/shared/src/security/sesHarden/runtimeCheck';
import { withSesCheckDeadline } from '@onekeyhq/shared/src/security/sesHarden/runtimeCheckDeadline';

export function useSesRuntimeCheckRun<TReport extends ISesRuntimeCheckReport>(
  collect: (signal: AbortSignal) => Promise<TReport>,
  timeoutMs = 65_000,
) {
  const [report, setReport] = useState<TReport>();
  const [error, setError] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);
  const runId = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const cancel = useCallback(() => {
    runId.current += 1;
    controller.current?.abort();
  }, []);
  const runChecks = useCallback(async () => {
    cancel();
    const id = runId.current;
    const abortController = new AbortController();
    controller.current = abortController;
    setReport(undefined);
    setError(undefined);
    setIsRunning(true);
    try {
      const next = await withSesCheckDeadline('SES diagnostic run', collect, {
        signal: abortController.signal,
        timeoutMs,
      });
      if (id === runId.current) setReport(next);
    } catch (cause) {
      if (id === runId.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (id === runId.current) setIsRunning(false);
    }
  }, [cancel, collect, timeoutMs]);
  useEffect(() => {
    void runChecks();
    return cancel;
  }, [cancel, runChecks]);
  return { report, error, isRunning, runChecks };
}
