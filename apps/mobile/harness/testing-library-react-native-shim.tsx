// Lightweight shim for @testing-library/react-native in the harness environment.
// @testing-library/react-native imports Node.js built-ins (console, util, picocolors) that Metro can't
// resolve. This shim re-implements renderHook/act/waitFor following @testing-library/react-native's
// source patterns, using react-test-renderer (pure JS, no Node.js or DOM deps).
//
// Reference: @testing-library/react-native v13.3.3
//   - build/render-hook.js   (renderHook)
//   - build/act.js           (act with IS_REACT_ACT_ENVIRONMENT)
//   - build/wait-for.js      (waitFor with interval polling)

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import type { ComponentType } from 'react';
import React from 'react';

import TestRenderer from 'react-test-renderer';

// ---------------------------------------------------------------------------
// act — mirrors @testing-library/react-native's withGlobalActEnvironment wrapper
// Sets IS_REACT_ACT_ENVIRONMENT=true during execution (React 18+ requirement)
// ---------------------------------------------------------------------------

function act(callback: () => void | Promise<void>): void | Promise<void> {
  const previousActEnvironment = (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  try {
    const actFn = (TestRenderer as any).act as (
      cb: () => void | Promise<void>,
    ) => any;
    let isCallbackAsync = false;
    const result = actFn(() => {
      const cbResult = callback();
      isCallbackAsync =
        cbResult !== null && cbResult !== undefined &&
        typeof cbResult === 'object' &&
        typeof (cbResult as any).then === 'function';
      return cbResult;
    });
    if (
      isCallbackAsync &&
      result !== null &&
      typeof result === 'object' &&
      typeof result.then === 'function'
    ) {
      return (result as Promise<void>).then(
        (returnValue) => {
          (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
          return returnValue;
        },
        (error) => {
          (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
          throw error;
        },
      );
    }
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    return result;
  } catch (error) {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// renderHook — mirrors @testing-library/react-native's render-hook.js
// Uses React.createRef + useEffect for result capture (same as @testing-library/react-native)
// ---------------------------------------------------------------------------

function renderHook<Result, Props = undefined>(
  hookToRender: (props: Props) => Result,
  options?: {
    initialProps?: Props;
    wrapper?: ComponentType<any>;
    concurrentRoot?: boolean;
  },
) {
  const result = React.createRef<Result>() as { current: Result };

  function HookContainer({ hookProps }: { hookProps: Props }) {
    const renderResult = hookToRender(hookProps);
    React.useEffect(() => {
      result.current = renderResult;
    });
    return null;
  }

  const { initialProps, wrapper: Wrapper, ...renderOptions } = options ?? {};

  let renderer: TestRenderer.ReactTestRenderer;
  void act(() => {
    const element = React.createElement(HookContainer, {
      hookProps: initialProps as Props,
    }) as any;
    const wrappedElement = Wrapper
      ? (React.createElement(Wrapper, null, element) as any)
      : element;
    renderer = TestRenderer.create(wrappedElement, renderOptions as any);
  });

  return {
    result,
    rerender: (hookProps: Props) => {
      const element = React.createElement(HookContainer, {
        hookProps,
      }) as any;
      const wrappedElement = Wrapper
        ? (React.createElement(Wrapper, null, element) as any)
        : element;
      void act(() => {
        renderer!.update(wrappedElement);
      });
    },
    unmount: () => {
      void act(() => {
        renderer!.unmount();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// waitFor — mirrors @testing-library/react-native's wait-for.js (real-timer path only)
// Harness does not support fake timers, so we only implement the real-timer
// branch: setInterval polling + overall timeout.
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

    const overallTimeoutTimer = setTimeout(handleTimeout, timeout);
    const intervalId = setInterval(checkExpectation, interval);

    // Initial check
    checkExpectation();

    function onDone(
      done: { type: 'result'; result: T } | { type: 'error'; error: unknown },
    ) {
      finished = true;
      clearTimeout(overallTimeoutTimer);
      clearInterval(intervalId);
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
  });
}

export { act, renderHook, waitFor };
