// Provide harness-compatible replacements for @testing-library/react.
//
// @testing-library/react uses react-dom which crashes on device (no DOM).
// We provide renderHook and act using react-test-renderer, which works in
// any JS environment including Hermes.
//
// The babel plugin (babel-plugin-jest-compat.js) rewrites:
//   import { renderHook, act } from '@testing-library/react'
// to:
//   const { renderHook, act } = globalThis.__harness_testing_lib__
//
// This avoids loading react-dom entirely on device.

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires */

// eslint-disable-next-line @typescript-eslint/naming-convention
const _React = require('react');
const _RTR = require('react-test-renderer');

const rtrAct: (cb: () => void | Promise<void>) => void | Promise<void> =
  _RTR.act ?? _React.act;

function renderHook<TResult>(
  callback: () => TResult,
  options?: { wrapper?: any },
) {
  const result = { current: undefined as unknown as TResult };

  function TestComponent() {
    result.current = callback();
    return null;
  }

  function buildElement() {
    const inner = _React.createElement(TestComponent);
    if (options?.wrapper) {
      return _React.createElement(options.wrapper, null, inner);
    }
    return inner;
  }

  let renderer: any;
  rtrAct(() => {
    renderer = _RTR.create(buildElement());
  });

  return {
    result,
    rerender: () => {
      rtrAct(() => {
        renderer.update(buildElement());
      });
    },
    unmount: () => {
      rtrAct(() => {
        renderer.unmount();
      });
    },
  };
}

// Expose as global so the babel plugin can redirect imports.
(globalThis as any).__harness_testing_lib__ = {
  renderHook,
  act: rtrAct,
  cleanup: () => {},
};
