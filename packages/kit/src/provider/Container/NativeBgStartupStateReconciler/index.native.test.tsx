/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EAtomNames } from '@onekeyhq/kit-bg/src/states/jotai/atomNames';
import { jotaiUpdateFromUiByBgBroadcast } from '@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import {
  NATIVE_BG_STARTUP_RECONCILE_DELAY_MS,
  NativeBgStartupStateReconciler,
} from './index.native';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    getAtomStates: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi', () => ({
  jotaiUpdateFromUiByBgBroadcast: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: jest.fn(),
      },
    },
  },
}));

// Mocked module methods do not depend on their object binding.
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedGetAtomStates = jest.mocked(backgroundApiProxy.getAtomStates);
const mockedUpdateAtomState = jest.mocked(jotaiUpdateFromUiByBgBroadcast);
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedLogError = jest.mocked(defaultLogger.app.error.log);

describe('NativeBgStartupStateReconciler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reconciles only the local DB open error after the startup delay', async () => {
    const localDbState = {
      errorMessage:
        'Provided schema version 19 is less than last set version 20.',
    };
    mockedGetAtomStates.mockResolvedValue({
      states: {
        [EAtomNames.localDbOpenErrorAtom]: localDbState,
      },
    });

    render(<NativeBgStartupStateReconciler />);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(
        NATIVE_BG_STARTUP_RECONCILE_DELAY_MS - 1,
      );
    });
    expect(mockedGetAtomStates).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
    });

    expect(mockedGetAtomStates).toHaveBeenCalledTimes(1);
    expect(mockedGetAtomStates).toHaveBeenCalledWith([
      EAtomNames.localDbOpenErrorAtom,
    ]);
    expect(mockedUpdateAtomState).toHaveBeenCalledWith({
      $$isFromBgStatesSyncBroadcast: true,
      name: EAtomNames.localDbOpenErrorAtom,
      payload: localDbState,
    });

    await act(async () => {
      await jest.advanceTimersByTimeAsync(NATIVE_BG_STARTUP_RECONCILE_DELAY_MS);
    });
    expect(mockedGetAtomStates).toHaveBeenCalledTimes(1);
  });

  it('cancels reconciliation when the provider unmounts', async () => {
    const view = render(<NativeBgStartupStateReconciler />);

    view.unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(NATIVE_BG_STARTUP_RECONCILE_DELAY_MS);
    });

    expect(mockedGetAtomStates).not.toHaveBeenCalled();
  });

  it('logs a background query failure without throwing', async () => {
    mockedGetAtomStates.mockRejectedValue(new Error('background unavailable'));

    render(<NativeBgStartupStateReconciler />);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(NATIVE_BG_STARTUP_RECONCILE_DELAY_MS);
    });

    expect(mockedLogError).toHaveBeenCalledWith(
      '[NativeBgStartupStateReconciler] background unavailable',
    );
  });
});
