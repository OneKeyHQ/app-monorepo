/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import { WebReferralBindGate as NativeWebReferralBindGate } from './WebReferralBindGate';
import { WebReferralBindGate } from './WebReferralBindGate.web-only';

type IGateTestState = {
  hasCode: boolean;
  reads: number;
  activateAfterFirstRead: boolean;
  listeners: Set<() => void>;
  moduleLoads: number;
  containerRenders: number;
};

const mockBag = globalThis as typeof globalThis & {
  __webReferralGateTest?: IGateTestState;
};

jest.mock('../../utils/webReferralCode', () => ({
  readWebReferralCode: () => {
    const state = mockBag.__webReferralGateTest;
    if (!state) return undefined;
    state.reads += 1;
    if (state.activateAfterFirstRead && state.reads === 1) {
      state.hasCode = true;
      return undefined;
    }
    return state.hasCode ? { code: 'TEST661', capturedAt: 1 } : undefined;
  },
  subscribeWebReferralCode: (listener: () => void) => {
    mockBag.__webReferralGateTest?.listeners.add(listener);
    return () => {
      mockBag.__webReferralGateTest?.listeners.delete(listener);
    };
  },
}));

jest.mock('./WebReferralBindContainer', () => {
  const state = mockBag.__webReferralGateTest;
  if (state) state.moduleLoads += 1;
  return {
    WebReferralBindContainer: () => {
      const currentState = mockBag.__webReferralGateTest;
      if (currentState) currentState.containerRenders += 1;
      return <div data-testid="referral-bind-container" />;
    },
  };
});

beforeEach(() => {
  mockBag.__webReferralGateTest = {
    hasCode: false,
    reads: 0,
    activateAfterFirstRead: false,
    listeners: new Set(),
    moduleLoads: 0,
    containerRenders: 0,
  };
});

afterEach(() => {
  delete mockBag.__webReferralGateTest;
});

it('does not load the binding module without a code and unsubscribes on unmount', () => {
  const view = render(<WebReferralBindGate />);
  expect(view.queryByTestId('referral-bind-container')).toBeNull();
  expect(mockBag.__webReferralGateTest?.moduleLoads).toBe(0);
  expect(mockBag.__webReferralGateTest?.listeners.size).toBe(1);
  view.unmount();
  expect(mockBag.__webReferralGateTest?.listeners.size).toBe(0);
});

it('loads the binding module when a code is present at mount', async () => {
  if (mockBag.__webReferralGateTest) {
    mockBag.__webReferralGateTest.hasCode = true;
  }
  const view = render(<WebReferralBindGate />);
  await waitFor(() =>
    expect(view.getByTestId('referral-bind-container')).toBeTruthy(),
  );
  expect(mockBag.__webReferralGateTest?.moduleLoads).toBe(1);
});

it('mounts after a later code and stays mounted when the code clears', async () => {
  const view = render(<WebReferralBindGate />);
  expect(view.queryByTestId('referral-bind-container')).toBeNull();
  const state = mockBag.__webReferralGateTest as IGateTestState;
  state.hasCode = true;
  act(() => state.listeners.forEach((listener) => listener()));
  await waitFor(() =>
    expect(view.getByTestId('referral-bind-container')).toBeTruthy(),
  );
  state.hasCode = false;
  act(() => state.listeners.forEach((listener) => listener()));
  expect(view.getByTestId('referral-bind-container')).toBeTruthy();
});

it('checks again after subscribing when code arrives between render and effect', async () => {
  if (mockBag.__webReferralGateTest) {
    mockBag.__webReferralGateTest.activateAfterFirstRead = true;
  }
  const view = render(<WebReferralBindGate />);
  await waitFor(() =>
    expect(view.getByTestId('referral-bind-container')).toBeTruthy(),
  );
  expect(mockBag.__webReferralGateTest?.reads).toBeGreaterThanOrEqual(2);
});

it('renders nothing from the generic gate', () => {
  const view = render(<NativeWebReferralBindGate />);
  expect(view.container.firstChild).toBeNull();
  expect(mockBag.__webReferralGateTest?.reads).toBe(0);
});
