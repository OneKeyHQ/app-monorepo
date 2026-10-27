/** @jest-environment jsdom */

import React, { StrictMode } from 'react';
import type { ComponentType, PropsWithChildren } from 'react';

import { HomeHistoryListView } from '.';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IHomeHistoryListViewProps } from './types';

// The installed runtime exposes Activity before the current React type package.
const Activity = (
  React as unknown as {
    Activity: ComponentType<PropsWithChildren<{ mode: 'visible' | 'hidden' }>>;
  }
).Activity;

const mockPage = {
  scrollTop: 0,
  height: 800,
  content: { scrollHeight: 200 },
  isFocused: true,
  owner: null,
};
jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
    testID,
    disabled,
    ..._props
  }: PropsWithChildren<{
    onPress: () => void;
    testID: string;
    disabled?: boolean;
  }>) => (
    <button data-testid={testID} onClick={onPress} disabled={disabled}>
      {children}
    </button>
  ),
  getTokenValue: () => 0,
  useStyle: () => ({}),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Retry' }),
}));
jest.mock('@onekeyhq/kit/src/components/AppPager/AppPagerContent', () => ({
  AppPagerContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@onekeyhq/kit/src/components/AppPager/useAppPagerPage', () => ({
  useAppPagerPage: () => mockPage,
}));
jest.mock('@onekeyhq/kit/src/components/TxHistoryListView', () => ({
  TxHistoryListView: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider',
  () => ({ withBrowserProvider: (component: unknown) => component }),
);
jest.mock('../../pages/hooks/useFrozenTopHistoryData', () => ({
  FrozenTopHistoryScrollObserver: () => null,
}));
jest.mock('./NativeHistoryList', () => ({ NativeHistoryList: () => null }));

function props(onEndReached: () => Promise<void>, count = 1) {
  return {
    initialized: true,
    data: Array.from({ length: count }, (_, index) => ({ id: `${index}` })),
    hasMore: true,
    isLoadingMore: false,
    onEndReached,
    frozenTopEnabled: true,
    frozenTopIdentityKey: 'account-A',
    observeFrozenTop: true,
    onAwayFromTopChange: jest.fn(),
  } as unknown as IHomeHistoryListViewProps;
}

it.each(['reject', 'empty', 'timeout'])(
  'retries a short page after %s without loading commits or scroll and bounds continued failures',
  async (kind) => {
    jest.useFakeTimers();
    const loadMore = jest.fn(() => {
      if (kind === 'reject') return Promise.reject(new Error('offline'));
      if (kind === 'timeout')
        return new Promise<void>((resolve) => setTimeout(resolve, 100));
      return Promise.resolve();
    });
    const view = render(<HomeHistoryListView {...props(loadMore)} />);
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(loadMore).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('history-pagination-retry')).toBeTruthy();
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(loadMore).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByTestId('history-pagination-retry'));
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(loadMore).toHaveBeenCalledTimes(3);
    view.rerender(<HomeHistoryListView {...props(loadMore, 2)} />);
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    await act(async () => {
      await jest.runAllTimersAsync();
    });
    expect(loadMore).toHaveBeenCalledTimes(5);
    view.unmount();
    jest.useRealTimers();
  },
);

it('does not treat a successful append committed with settlement as a failed old page', async () => {
  let resolve: () => void = () => {};
  const loadMore = jest.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const view = render(<HomeHistoryListView {...props(loadMore)} />);
  await act(async () => {
    view.rerender(<HomeHistoryListView {...props(loadMore, 2)} />);
    resolve();
  });
  expect(loadMore).toHaveBeenCalledTimes(2);
  view.unmount();
});

it('ignores settlement from an unmounted account', async () => {
  let resolve: () => void = () => {};
  const loadMore = jest.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const view = render(<HomeHistoryListView {...props(loadMore)} />);
  view.unmount();
  await act(async () => {
    resolve();
  });
  expect(loadMore).toHaveBeenCalledTimes(1);
});

it('waits on inactive, terminal or locally pending pages and ignores geometry changes after the budget', async () => {
  const loadMore = jest.fn(() => Promise.resolve());
  const view = render(<HomeHistoryListView {...props(loadMore)} />);
  await act(async () => {});
  expect(loadMore).toHaveBeenCalledTimes(2);
  mockPage.scrollTop = 5;
  view.rerender(<HomeHistoryListView {...props(loadMore)} />);
  await act(async () => {});
  expect(loadMore).toHaveBeenCalledTimes(2);
  mockPage.isFocused = false;
  view.rerender(<HomeHistoryListView {...props(loadMore, 2)} />);
  await act(async () => {});
  expect(loadMore).toHaveBeenCalledTimes(2);
  mockPage.isFocused = true;
  view.rerender(
    <HomeHistoryListView {...props(loadMore, 2)} hasMore={false} />,
  );
  await act(async () => {});
  expect(loadMore).toHaveBeenCalledTimes(2);
  view.unmount();
  mockPage.scrollTop = 0;
});

it('disables manual retry while its local promise is pending, even with loading=false', async () => {
  let resolve: () => void = () => {};
  const loadMore = jest
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockResolvedValueOnce(undefined)
    .mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
  const view = render(<HomeHistoryListView {...props(loadMore)} />);
  await act(async () => {});
  fireEvent.click(screen.getByTestId('history-pagination-retry'));
  expect(
    (screen.getByTestId('history-pagination-retry') as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByTestId('history-pagination-retry'));
  expect(loadMore).toHaveBeenCalledTimes(3);
  await act(async () => {
    resolve();
  });
  expect(loadMore).toHaveBeenCalledTimes(3);
  expect(
    (screen.getByTestId('history-pagination-retry') as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  view.unmount();
});

it('keeps the in-flight request owned through StrictMode effect replay', async () => {
  const loadMore = jest.fn(() => Promise.resolve());
  const view = render(
    <StrictMode>
      <HomeHistoryListView {...props(loadMore)} />
    </StrictMode>,
  );
  await act(async () => {});
  expect(loadMore).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('history-pagination-retry')).toBeTruthy();
  view.unmount();
});

it('remembers settlement while Activity is disconnected and resumes the bounded retry on reconnect', async () => {
  let resolve: () => void = () => {};
  const loadMore = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue(undefined);
  const content = (mode: 'visible' | 'hidden') => (
    <Activity mode={mode}>
      <HomeHistoryListView {...props(loadMore)} />
    </Activity>
  );
  const view = render(content('visible'));
  expect(loadMore).toHaveBeenCalledTimes(1);
  view.rerender(content('hidden'));
  await act(async () => {
    resolve();
  });
  expect(loadMore).toHaveBeenCalledTimes(1);
  view.rerender(content('visible'));
  await act(async () => {});
  expect(loadMore).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('history-pagination-retry')).toBeTruthy();
  view.unmount();
});
