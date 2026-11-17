/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { OS_END_OF_SUPPORT_NOTICE_REMIND_INTERVAL_MS } from '@onekeyhq/shared/src/osEndOfSupport';

import { OsEndOfSupportAlert } from './OsEndOfSupportAlert';

const ALERT_TEST_ID = 'os-end-of-support-alert';
const CLOSE_TEST_ID = 'os-end-of-support-alert-close';
const START = 1_800_000_000_000;
const WEEK = OS_END_OF_SUPPORT_NOTICE_REMIND_INTERVAL_MS;

let mockIsFocused = true;
const mockFocusListeners = new Set<() => void>();
const mockSubscribeFocus = (listener: () => void) => {
  mockFocusListeners.add(listener);
  return () => {
    mockFocusListeners.delete(listener);
  };
};
function setFocused(isFocused: boolean) {
  mockIsFocused = isFocused;
  mockFocusListeners.forEach((listener) => listener());
}
let mockAppActiveHandler: (() => void) | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@react-navigation/core', () => {
  const { useSyncExternalStore } =
    jest.requireActual<typeof import('react')>('react');
  return {
    useIsFocused: () =>
      useSyncExternalStore(mockSubscribeFocus, () => mockIsFocused),
  };
});
jest.mock('../hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: (handler?: () => void) => {
    mockAppActiveHandler = handler;
  },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/osEndOfSupport', () => ({
  ...jest.requireActual<typeof import('@onekeyhq/shared/src/osEndOfSupport')>(
    '@onekeyhq/shared/src/osEndOfSupport',
  ),
  getOsEndOfSupportNotice: () => ({
    id: 'os-end-of-support:android:29',
    minSupportedName: 'Android 10',
    learnMoreUrl: undefined,
  }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const { useState } = jest.requireActual<typeof import('react')>('react');
  return {
    useOsEndOfSupportNoticePersistAtom: () =>
      useState({ dismissedAt: {} as Record<string, number> }),
  };
});
jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Button: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Alert: ({
    testID,
    onClose,
    children,
  }: {
    testID?: string;
    onClose?: () => void;
    children?: ReactNode;
  }) => (
    <div data-testid={testID}>
      <button type="button" data-testid={`${testID}-close`} onClick={onClose}>
        close
      </button>
      {children}
    </div>
  ),
}));

function closeAlert() {
  fireEvent.click(screen.getByTestId(CLOSE_TEST_ID));
}

describe('OsEndOfSupportAlert', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
    mockIsFocused = true;
    mockAppActiveHandler = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('comes back after one week while the same component stays mounted', () => {
    render(<OsEndOfSupportAlert />);
    expect(screen.queryByTestId(ALERT_TEST_ID)).not.toBeNull();

    closeAlert();
    expect(screen.queryByTestId(ALERT_TEST_ID)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(WEEK - 1);
    });
    expect(screen.queryByTestId(ALERT_TEST_ID)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId(ALERT_TEST_ID)).not.toBeNull();
  });

  it('re-checks when the app returns to the foreground after a suspended week', () => {
    render(<OsEndOfSupportAlert />);
    closeAlert();

    // The clock jumps without any JS timer firing, as after a long suspension.
    jest.setSystemTime(START + WEEK);
    expect(screen.queryByTestId(ALERT_TEST_ID)).toBeNull();

    act(() => {
      mockAppActiveHandler?.();
    });
    expect(screen.queryByTestId(ALERT_TEST_ID)).not.toBeNull();
  });

  it('re-checks when Home regains focus', () => {
    render(<OsEndOfSupportAlert />);
    closeAlert();

    act(() => {
      setFocused(false);
    });
    jest.setSystemTime(START + WEEK);
    expect(screen.queryByTestId(ALERT_TEST_ID)).toBeNull();

    act(() => {
      setFocused(true);
    });
    expect(screen.queryByTestId(ALERT_TEST_ID)).not.toBeNull();
  });

  it('stays hidden when the app returns within the week', () => {
    render(<OsEndOfSupportAlert />);
    closeAlert();

    jest.setSystemTime(START + WEEK - 1);
    act(() => {
      mockAppActiveHandler?.();
    });
    expect(screen.queryByTestId(ALERT_TEST_ID)).toBeNull();
  });
});
