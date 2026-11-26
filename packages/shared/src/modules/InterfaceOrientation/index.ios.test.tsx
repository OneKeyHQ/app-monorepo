/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { useInterfaceOrientation } from './index.ios';

import type { IInterfaceOrientation } from './types';

type IListener = (orientation: IInterfaceOrientation) => void;

let mockDeviceUtils: Record<string, unknown> = {};

jest.mock('@onekeyfe/react-native-device-utils', () => ({
  get ReactNativeDeviceUtils() {
    return mockDeviceUtils;
  },
}));

let nativeOrientation: IInterfaceOrientation;
let listeners: Map<number, IListener>;

function createDeviceUtils() {
  let nextListenerId = 1;
  return {
    getInterfaceOrientation: jest.fn(() => nativeOrientation),
    addInterfaceOrientationChangedListener: jest.fn((listener: IListener) => {
      const id = nextListenerId;
      nextListenerId += 1;
      listeners.set(id, listener);
      return id;
    }),
    removeInterfaceOrientationChangedListener: jest.fn((id: number) => {
      listeners.delete(id);
    }),
  };
}

function rotate(orientation: IInterfaceOrientation) {
  act(() => {
    nativeOrientation = orientation;
    listeners.forEach((listener) => listener(orientation));
  });
}

function Probe() {
  return <span>{useInterfaceOrientation()}</span>;
}

beforeEach(() => {
  nativeOrientation = 'portrait';
  listeners = new Map();
  mockDeviceUtils = createDeviceUtils();
});

it('follows the orientation of the window scene', () => {
  const view = render(<Probe />);
  expect(view.container.textContent).toBe('portrait');
  rotate('landscapeRight');
  expect(view.container.textContent).toBe('landscapeRight');
  // A 180 degree turn keeps the window size but moves the sensor housing.
  rotate('landscapeLeft');
  expect(view.container.textContent).toBe('landscapeLeft');
});

it('keeps a rotation that lands before the listener is added', () => {
  const deviceUtils = createDeviceUtils();
  deviceUtils.addInterfaceOrientationChangedListener.mockImplementation(
    (listener: IListener) => {
      // The scene turned between the render and the subscription.
      nativeOrientation = 'landscapeRight';
      listeners.set(1, listener);
      return 1;
    },
  );
  mockDeviceUtils = deviceUtils;
  const view = render(<Probe />);
  expect(view.container.textContent).toBe('landscapeRight');
});

it('stops listening once nothing reads the orientation', () => {
  const view = render(<Probe />);
  expect(listeners.size).toBe(1);
  view.unmount();
  expect(listeners.size).toBe(0);
});

it('reports an unknown orientation on a native shell without the API', () => {
  mockDeviceUtils = {};
  const view = render(<Probe />);
  expect(view.container.textContent).toBe('unknown');
  view.unmount();
});
