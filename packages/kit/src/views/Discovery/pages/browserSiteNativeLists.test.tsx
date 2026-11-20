/** @jest-environment jsdom */

import type { PropsWithChildren, ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import BookmarkListModal from './BookmarkListModal';
import HistoryListModal from './HistoryListModal';

import type {
  NativeListProps,
  NativeListTheme,
} from '@onekeyfe/react-native-native-list';

const mockGetBookmarkData = jest.fn();
const mockFetchHistoryData = jest.fn();
const mockSortBookmark = jest.fn();
const mockRemoveBookmark = jest.fn();
const mockRemoveHistory = jest.fn();
const mockOpenSite = jest.fn();
let mockList: NativeListProps;

jest.mock('react-native', () => ({
  PixelRatio: { get: () => 1 },
  StyleSheet: { hairlineWidth: 1 },
}));
jest.mock('@onekeyfe/react-native-native-list', () => {
  const { validateSnapshot } = jest.requireActual<
    typeof import('@onekeyfe/react-native-native-list')
  >(
    require
      .resolve('@onekeyfe/react-native-native-list/package.json')
      .replace(/package\.json$/, 'src/validation.ts'),
  );
  return {
    NativeList: (props: NativeListProps) => {
      validateSnapshot(props.snapshot);
      mockList = props;
      return null;
    },
  };
});

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: PropsWithChildren) => <div>{children}</div>;
  const theme = {
    borderSubdued: { val: '#000000' },
    iconCritical: { val: '#000000' },
  };
  return {
    Button: ({
      children,
      onPress,
    }: PropsWithChildren<{ onPress: () => void }>) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    Divider: Wrapper,
    Empty: () => null,
    IconButton: () => null,
    Page: Object.assign(Wrapper, {
      Body: Wrapper,
      Header: ({ headerRight }: { headerRight: () => ReactNode }) =>
        headerRight(),
    }),
    Toast: { success: jest.fn() },
    XStack: Wrapper,
    useTheme: () => theme,
  };
});
jest.mock('react-intl', () => {
  const intl = { formatMessage: ({ id }: { id: string }) => id };
  return { useIntl: () => intl };
});
jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  formatRelativeDate: (date: Date) => date.toISOString().slice(0, 10),
}));
jest.mock('../../Home/hooks/useHomeNativeListTheme', () => {
  const theme: NativeListTheme = {
    background: '#000000',
    rowBackground: '#000000',
    rowSelectedBackground: '#000000',
    primaryText: '#ffffff',
    secondaryText: '#ffffff',
    icon: '#ffffff',
    iconSubdued: '#ffffff',
    separator: '#000000',
    accent: '#ffffff',
    positive: '#ffffff',
    negative: '#ffffff',
  };
  return { useHomeNativeListTheme: () => theme };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDiscovery: {
      get getBookmarkData() {
        return mockGetBookmarkData;
      },
      get fetchHistoryData() {
        return mockFetchHistoryData;
      },
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/RenameDialog', () => ({
  RenameInputWithNameSelector: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const { useCallback, useEffect, useRef, useState } =
    jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: <T,>(fetch: () => Promise<T>, [page]: number[] = []) => {
      const [result, setResult] = useState<T>();
      const fetchRef = useRef(fetch);
      fetchRef.current = fetch;
      const run = useCallback(async () => {
        setResult(await fetchRef.current());
      }, []);
      useEffect(() => void run(), [run, page]);
      return { result, run };
    },
  };
});
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/discovery', () => ({
  useBrowserBookmarkAction: () => ({
    current: {
      sortBrowserBookmark: mockSortBookmark,
      removeBrowserBookmark: mockRemoveBookmark,
    },
  }),
  useBrowserHistoryAction: () => ({
    current: { removeBrowserHistory: mockRemoveHistory },
  }),
}));
jest.mock('../hooks/useWebSiteHandler', () => ({
  useWebSiteHandler: () => mockOpenSite,
}));
jest.mock('./Browser/WithBrowserProvider', () => ({
  withBrowserProvider: (component: unknown) => component,
}));

const urlPrefix = `https://example.com/?query=${'q'.repeat(5000)}`;
const longTitlePrefix = 'a'.repeat(4095);
const longTitle = `${longTitlePrefix}😀`;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

it('renders long bookmarks and uses their full URLs for press, reorder, and remove', async () => {
  const first = {
    url: `${urlPrefix}1`,
    title: longTitle,
    logo: undefined,
    sortIndex: 1,
  };
  const second = { ...first, url: `${urlPrefix}2`, title: '', sortIndex: 2 };
  mockGetBookmarkData.mockResolvedValue([first, second]);
  render(<BookmarkListModal />);
  await waitFor(() => expect(mockList?.snapshot.rows).toHaveLength(2));

  const [firstRow, secondRow] = mockList.snapshot.rows;
  expect(firstRow).toMatchObject({
    height: 60,
    heightRounding: 'nearest',
    title: longTitlePrefix,
    subtitle: first.url.slice(0, 4096),
  });
  expect(secondRow).toMatchObject({ title: second.url.slice(0, 4096) });
  expect(firstRow.key).not.toBe(secondRow.key);
  act(() =>
    mockList.onRowAction?.({ rowKey: firstRow.key, actionKey: 'press' }),
  );
  expect(mockOpenSite).toHaveBeenCalledWith(
    expect.objectContaining({
      webSite: expect.objectContaining({ url: first.url, title: longTitle }),
    }),
  );

  fireEvent.click(screen.getByRole('button'));
  expect(mockList.snapshot.capabilities?.reorderActivation).toBe('handle');
  act(() =>
    mockList.onReorder?.({ key: secondRow.key, fromIndex: 1, toIndex: 0 }),
  );
  expect(mockList.snapshot.rows.map(({ key }) => key)).toEqual([
    secondRow.key,
    firstRow.key,
  ]);
  expect(mockSortBookmark).toHaveBeenCalledWith({
    target: second,
    prev: undefined,
    next: first,
  });
  act(() =>
    mockList.onRowAction?.({ rowKey: firstRow.key, actionKey: 'remove' }),
  );
  expect(mockRemoveBookmark).toHaveBeenCalledWith(first.url);
});

it('renders long recently closed entries and opens the full URL and title', async () => {
  const entry = {
    id: 'history-1',
    url: urlPrefix,
    title: longTitle,
    createdAt: Date.UTC(2026, 10, 20),
  };
  mockFetchHistoryData.mockResolvedValue({
    data: [
      entry,
      { ...entry, id: 'history-2', createdAt: Date.UTC(2026, 10, 19) },
    ],
    hasMore: false,
  });
  render(<HistoryListModal />);
  await waitFor(() => expect(mockList?.snapshot.rows[1]?.key).toBe(entry.id));
  expect(mockList.snapshot.rows).toMatchObject([
    { type: 'sectionHeader', height: 36, heightRounding: 'nearest' },
    {
      key: entry.id,
      type: 'identity',
      height: 60,
      heightRounding: 'nearest',
      title: longTitlePrefix,
      subtitle: entry.url.slice(0, 4096),
    },
    { type: 'system', height: 20, heightRounding: 'nearest' },
    { type: 'sectionHeader', height: 36, heightRounding: 'nearest' },
    { type: 'identity', height: 60, heightRounding: 'nearest' },
  ]);

  act(() => mockList.onRowAction?.({ rowKey: entry.id, actionKey: 'press' }));
  expect(mockOpenSite).toHaveBeenCalledWith(
    expect.objectContaining({
      webSite: expect.objectContaining({ url: entry.url, title: longTitle }),
    }),
  );
});

it('keeps the same bookmark snapshot when a reorder is read back with new metadata', async () => {
  jest.useFakeTimers();
  const first = {
    url: 'https://example.com/first',
    title: 'First',
    sortIndex: 1,
  };
  const second = {
    url: 'https://example.com/second',
    title: 'Second',
    sortIndex: 2,
  };
  const persistedSecond = { ...second, sortIndex: 0 };
  mockGetBookmarkData.mockResolvedValueOnce([first, second]);
  mockGetBookmarkData.mockResolvedValueOnce([persistedSecond, first]);
  render(<BookmarkListModal />);
  await waitFor(() => expect(mockList.snapshot.rows).toHaveLength(2));
  fireEvent.click(screen.getByRole('button'));

  const [firstRow, secondRow] = mockList.snapshot.rows;
  act(() =>
    mockList.onReorder?.({ key: secondRow.key, fromIndex: 1, toIndex: 0 }),
  );
  const reorderedSnapshot = mockList.snapshot;
  await act(async () => {
    appEventBus.emit(EAppEventBusNames.RefreshBookmarkList, undefined);
    await jest.advanceTimersByTimeAsync(200);
  });

  expect(mockGetBookmarkData).toHaveBeenCalledTimes(2);
  expect(mockList.snapshot).toBe(reorderedSnapshot);
  act(() =>
    mockList.onReorder?.({ key: firstRow.key, fromIndex: 1, toIndex: 0 }),
  );
  expect(mockSortBookmark).toHaveBeenLastCalledWith({
    target: first,
    prev: undefined,
    next: persistedSecond,
  });
});

it('requests one history page at the visible tail and ignores stale or finished pagination', async () => {
  jest.useFakeTimers();
  const entries = Array.from({ length: 30 }, (_, index) => ({
    id: `history-${index}`,
    url: `https://example.com/${index}`,
    title: `Entry ${index}`,
    createdAt: Date.UTC(2026, 10, 20),
  }));
  mockFetchHistoryData.mockResolvedValueOnce({
    data: entries.slice(0, 15),
    hasMore: true,
  });
  mockFetchHistoryData.mockResolvedValueOnce({ data: entries, hasMore: false });
  render(<HistoryListModal />);
  await waitFor(() => expect(mockList.snapshot.rows).toHaveLength(16));
  expect(mockList.snapshot.capabilities).toEqual({
    endReachedThreshold: 0,
    loadMore: true,
  });

  const previousGeneration = mockList.snapshot.generation;
  await act(async () => {
    mockList.onEndReached?.({ generation: previousGeneration });
    mockList.onEndReached?.({ generation: previousGeneration });
    await jest.advanceTimersByTimeAsync(500);
  });
  await waitFor(() => expect(mockList.snapshot.rows).toHaveLength(31));
  expect(mockList.snapshot.capabilities?.loadMore).toBe(false);
  await act(async () => {
    mockList.onEndReached?.({ generation: previousGeneration });
    mockList.onEndReached?.({ generation: mockList.snapshot.generation });
    await jest.advanceTimersByTimeAsync(500);
  });
  expect(mockFetchHistoryData.mock.calls).toEqual([[1], [2]]);
});
