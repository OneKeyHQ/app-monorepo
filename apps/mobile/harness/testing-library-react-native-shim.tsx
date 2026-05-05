// Lightweight shim for @testing-library/react-native in the harness environment.
// @testing-library/react-native imports Node.js built-ins (console, util,
// picocolors) that Metro can't resolve. This shim re-implements
// renderHook/act/waitFor using react-test-renderer (pure JS, no Node.js or
// DOM deps).
//
// Reference: @testing-library/react-native v13.3.3
//   - build/render-hook.js   (renderHook)
//   - build/act.js           (act with IS_REACT_ACT_ENVIRONMENT)
//   - build/wait-for.js      (waitFor with interval polling)

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import { createElement } from 'react';
import type { ComponentType } from 'react';

import TestRenderer from 'react-test-renderer';

// ---------------------------------------------------------------------------
// act — for synchronous callbacks we delegate to TestRenderer.act directly.
// For async callbacks, React.act() hangs on Hermes (it never resolves its
// returned thenable), so we await the callback ourselves and then run a sync
// act() pass to flush any remaining React effects.
// ---------------------------------------------------------------------------

const syncAct = (TestRenderer as any).act as (cb: () => void) => void;

function act(callback: () => void | Promise<void>): void | Promise<void> {
  const previousActEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

  // Run the callback inside syncAct so that sync callbacks get proper React
  // batching and effect flushing. After syncAct completes, check whether the
  // callback returned a Promise (async). If so, await it and flush again.
  let cbResult!: void | Promise<void>;
  try {
    syncAct(() => {
      cbResult = callback();
    });
  } catch (error) {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    throw error;
  }

  const isAsync =
    cbResult !== null &&
    cbResult !== undefined &&
    typeof cbResult === 'object' &&
    typeof (cbResult as any).then === 'function';

  if (isAsync) {
    // Async path: the callback returned a Promise. React.act(async) hangs on
    // Hermes, so we await the promise ourselves and then do a sync act() pass
    // to flush any remaining effects scheduled during the async work.
    return (cbResult as Promise<void>).then(
      () => {
        try {
          syncAct(() => {});
        } catch {
          // ignore flush errors
        }
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
      },
      (error) => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        throw error;
      },
    );
  }

  // Sync path: syncAct already batched and flushed everything.
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  return undefined;
}

// ---------------------------------------------------------------------------
// renderHook — mirrors @testing-library/react-native's render-hook.js
// Uses React.createRef + useEffect for result capture
// ---------------------------------------------------------------------------

function renderHook<Result, Props = undefined>(
  hookToRender: (props: Props) => Result,
  options?: {
    initialProps?: Props;
    wrapper?: ComponentType<any>;
    concurrentRoot?: boolean;
  },
) {
  const result = { current: undefined as Result };

  function HookContainer({ hookProps }: { hookProps: Props }) {
    const renderResult = hookToRender(hookProps);
    result.current = renderResult;
    return null;
  }

  const { initialProps, wrapper: Wrapper, ...renderOptions } = options ?? {};

  let renderer: TestRenderer.ReactTestRenderer;
  syncAct(() => {
    const element = createElement(HookContainer, {
      hookProps: initialProps as unknown as Props,
    }) as any;
    const wrappedElement = Wrapper
      ? (createElement(Wrapper, null, element) as any)
      : element;
    renderer = TestRenderer.create(wrappedElement, renderOptions as any);
  });

  return {
    result,
    rerender: (hookProps: Props) => {
      const element = createElement(HookContainer, {
        hookProps,
      }) as any;
      const wrappedElement = Wrapper
        ? (createElement(Wrapper, null, element) as any)
        : element;
      syncAct(() => {
        renderer.update(wrappedElement);
      });
    },
    unmount: () => {
      syncAct(() => {
        renderer.unmount();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// waitFor — mirrors @testing-library/react-native's wait-for.js (real-timer
// path only). Harness does not support fake timers, so we only implement the
// real-timer branch: setInterval polling + overall timeout.
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT = 1000;
const DEFAULT_INTERVAL = 50;

async function waitFor<T>(
  expectation: () => T | Promise<T>,
  options?: { timeout?: number; interval?: number },
): Promise<T> {
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
  const interval = options?.interval ?? DEFAULT_INTERVAL;

  return new Promise<T>((resolve, reject) => {
    let lastError: unknown;
    let finished = false;
    let promiseStatus: 'idle' | 'pending' | 'resolved' | 'rejected' = 'idle';
    const timers: {
      timeout?: ReturnType<typeof setTimeout>;
      interval?: ReturnType<typeof setInterval>;
    } = {};

    function onDone(
      done: { type: 'result'; result: T } | { type: 'error'; error: unknown },
    ) {
      finished = true;
      clearTimeout(timers.timeout);
      clearInterval(timers.interval);
      if (done.type === 'error') {
        reject(done.error);
      } else {
        resolve(done.result);
      }
    }

    function checkExpectation() {
      if (finished || promiseStatus === 'pending') return;
      try {
        const checkResult = expectation();
        if (
          checkResult !== null &&
          typeof checkResult === 'object' &&
          typeof (checkResult as any).then === 'function'
        ) {
          promiseStatus = 'pending';
          (checkResult as Promise<T>).then(
            (resolvedValue) => {
              promiseStatus = 'resolved';
              onDone({ type: 'result', result: resolvedValue });
            },
            (rejectedValue) => {
              promiseStatus = 'rejected';
              lastError = rejectedValue;
            },
          );
        } else {
          onDone({ type: 'result', result: checkResult as T });
        }
      } catch (error) {
        lastError = error;
      }
    }

    function handleTimeout() {
      const error =
        lastError instanceof Error
          ? lastError
          : new Error(lastError ? String(lastError) : 'Timed out in waitFor.');
      onDone({ type: 'error', error });
    }

    timers.timeout = setTimeout(handleTimeout, timeout);
    timers.interval = setInterval(checkExpectation, interval);

    // Initial check
    checkExpectation();
  });
}

export { act, renderHook, waitFor };
