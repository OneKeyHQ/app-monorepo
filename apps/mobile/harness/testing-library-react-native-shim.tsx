// Lightweight shim for @testing-library/react-native in the harness environment.
// RNTL imports Node.js built-ins (console, util, picocolors) that Metro can't
// resolve. This shim provides renderHook/act/waitFor using react-test-renderer
// (pure JS, no Node.js or DOM dependencies).

import type { ComponentType, ReactNode } from 'react';
import React from 'react';
import TestRenderer from 'react-test-renderer';

const { act } = TestRenderer;

function renderHook<Result, Props = undefined>(
  callback: Props extends undefined ? () => Result : (props: Props) => Result,
  options?: {
    initialProps?: Props;
    wrapper?: ComponentType<{ children: ReactNode }>;
  },
) {
  const result: { current: Result } = { current: null as unknown as Result };
  let currentProps = options?.initialProps as Props;

  function HookContainer() {
    result.current = (callback as (props: Props) => Result)(currentProps);
    return null;
  }

  const Wrapper = options?.wrapper ?? React.Fragment;

  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <Wrapper>
        <HookContainer />
      </Wrapper>,
    );
  });

  return {
    result,
    rerender: (newProps?: Props) => {
      if (newProps !== undefined) {
        currentProps = newProps;
      }
      act(() => {
        renderer.update(
          <Wrapper>
            <HookContainer />
          </Wrapper>,
        );
      });
    },
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
}

async function waitFor<T>(
  callback: () => T | Promise<T>,
  options?: { timeout?: number; interval?: number },
): Promise<T> {
  const timeout = options?.timeout ?? 1000;
  const interval = options?.interval ?? 50;
  const start = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const r = await callback();
      return r;
    } catch (e) {
      if (Date.now() - start >= timeout) {
        throw e;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, interval);
      });
    }
  }
}

export { act, renderHook, waitFor };
