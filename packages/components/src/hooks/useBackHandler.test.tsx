/** @jest-environment jsdom */
import path from 'path';

import { overlayStore } from '@onekeyfe/react-native-native-overlay';
import { cleanup, fireEvent, renderHook } from '@testing-library/react';

import { useBackHandler } from './useBackHandler';

import type {
  IOverlayLevel,
  IOverlayRequestDismissReason,
} from '@onekeyfe/react-native-native-overlay';

jest.mock('@onekeyfe/react-native-native-overlay', () => {
  const sdkPath = jest.requireActual<typeof import('path')>('path');
  return jest.requireActual<
    Pick<typeof import('@onekeyfe/react-native-native-overlay'), 'overlayStore'>
  >(
    sdkPath.join(
      sdkPath.dirname(
        require.resolve('@onekeyfe/react-native-native-overlay/package.json'),
      ),
      'src/OverlayStore',
    ),
  );
});

const { getOverlayLayerRoot, registerOverlayDismissRequester } =
  jest.requireActual<{
    getOverlayLayerRoot: (level: IOverlayLevel) => HTMLDivElement;
    registerOverlayDismissRequester: (
      id: string,
      requester: (reason: IOverlayRequestDismissReason) => void,
    ) => () => void;
  }>(
    path.join(
      path.dirname(
        require.resolve('@onekeyfe/react-native-native-overlay/package.json'),
      ),
      'src/web/overlayLayers',
    ),
  );

const releaseRequesters: (() => void)[] = [];
const escape = (type: 'keydown' | 'keyup', options: KeyboardEventInit = {}) =>
  fireEvent(
    document,
    new KeyboardEvent(type, {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
      ...options,
    }),
  );

const listenerDescriptors = new Map(
  ['addEventListener', 'removeEventListener'].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);
beforeAll(() => {
  // The shared Jest setup replaces this DOM method with a no-op.
  Object.defineProperties(globalThis, {
    addEventListener: {
      configurable: true,
      writable: true,
      value: EventTarget.prototype.addEventListener.bind(globalThis),
    },
    removeEventListener: {
      configurable: true,
      writable: true,
      value: EventTarget.prototype.removeEventListener.bind(globalThis),
    },
  });
  getOverlayLayerRoot('modal');
});
afterAll(() => {
  for (const [name, descriptor] of listenerDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});
afterEach(() => {
  cleanup();
  releaseRequesters.splice(0).forEach((release) => release());
  overlayStore
    .getSnapshot()
    .entries.forEach(({ id }) => overlayStore.finalize(id));
});

it('keeps a blocking Dialog and its Modal route open for the complete Escape pair', () => {
  const pop = jest.fn();
  renderHook(() => useBackHandler(pop, true, false));
  const dialog = overlayStore.request({ blocking: true, dismissible: false });
  escape('keydown');
  escape('keyup');
  expect(pop).not.toHaveBeenCalled();
  expect(overlayStore.getEntry(dialog.id)?.phase).toBe('active');
  overlayStore.finalize(dialog.id);
  escape('keydown');
  escape('keyup');
  expect(pop).toHaveBeenCalledTimes(1);
});

it.each(['closing', 'finalized'])(
  'does not pop after SDK dismissal is %s before keyup',
  (phase) => {
    const pop = jest.fn();
    renderHook(() => useBackHandler(pop, true, false));
    const entry = overlayStore.request({ blocking: false, dismissible: true });
    const dismissed = jest.fn(() => {
      overlayStore.dismiss(entry.id, 'back');
      if (phase === 'finalized') overlayStore.finalize(entry.id);
    });
    releaseRequesters.push(
      registerOverlayDismissRequester(entry.id, dismissed),
    );
    escape('keydown');
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(overlayStore.resolveBack().kind).toBe('pass');
    escape('keydown', { repeat: true });
    escape('keyup');
    expect(pop).not.toHaveBeenCalled();
  },
);

it('retains ownership across callback rerenders and calls the latest callback on the next pair', () => {
  const oldCallback = jest.fn();
  const latestCallback = jest.fn();
  const view = renderHook(
    ({ callback }) => useBackHandler(callback, true, false),
    {
      initialProps: { callback: oldCallback },
    },
  );
  const entry = overlayStore.request({ dismissible: false });
  escape('keydown');
  overlayStore.finalize(entry.id);
  view.rerender({ callback: latestCallback });
  escape('keyup');
  expect(oldCallback).not.toHaveBeenCalled();
  expect(latestCallback).not.toHaveBeenCalled();
  escape('keydown');
  escape('keyup');
  expect(latestCallback).toHaveBeenCalledTimes(1);
});

it('lets neither of two keyup handlers pop when keydown belonged to an overlay', () => {
  const first = jest.fn();
  const second = jest.fn();
  renderHook(() => {
    useBackHandler(first, true, false);
    useBackHandler(second, true, false);
  });
  const entry = overlayStore.request({ dismissible: false });
  escape('keydown');
  overlayStore.finalize(entry.id);
  escape('keyup');
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();
});

it('checks an overlay that appeared after keydown', () => {
  const pop = jest.fn();
  renderHook(() => useBackHandler(pop, true, false));
  escape('keydown');
  overlayStore.request({ dismissible: false });
  escape('keyup');
  expect(pop).not.toHaveBeenCalled();
});

it.each([{ isComposing: true }, { keyCode: 229 }])(
  'leaves an IME Escape pair alone: %j',
  (options) => {
    const pop = jest.fn();
    renderHook(() => useBackHandler(pop, true, false));
    escape('keydown', options);
    escape('keyup', { isComposing: false, keyCode: 27 });
    expect(pop).not.toHaveBeenCalled();
    escape('keydown');
    escape('keyup');
    expect(pop).toHaveBeenCalledTimes(1);
  },
);

it('resets pairing on blur, disable and unmount', () => {
  const pop = jest.fn();
  const view = renderHook(
    ({ enabled }) => useBackHandler(pop, enabled, false),
    {
      initialProps: { enabled: true },
    },
  );
  const entry = overlayStore.request({ dismissible: false });
  escape('keydown');
  overlayStore.finalize(entry.id);
  globalThis.dispatchEvent(new Event('blur'));
  escape('keydown');
  escape('keyup');
  expect(pop).toHaveBeenCalledTimes(1);
  const nextEntry = overlayStore.request({ dismissible: false });
  escape('keydown');
  view.rerender({ enabled: false });
  escape('keyup');
  expect(pop).toHaveBeenCalledTimes(1);
  overlayStore.finalize(nextEntry.id);
  view.rerender({ enabled: true });
  escape('keydown');
  escape('keyup');
  expect(pop).toHaveBeenCalledTimes(2);
  view.unmount();
  escape('keyup');
  expect(pop).toHaveBeenCalledTimes(2);
});
