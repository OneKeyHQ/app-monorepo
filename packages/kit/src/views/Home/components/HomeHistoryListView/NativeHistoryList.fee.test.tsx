import * as React from 'react';

import { act, render } from '@testing-library/react-native';

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { NativeHistoryList } from './NativeHistoryList';

import type { IHomeHistoryListViewProps } from './types';
import type {
  ActivityRow,
  NativeListSnapshot,
} from '@onekeyfe/react-native-native-list';
import type { LayoutChangeEvent } from 'react-native';

let mockSnapshot: NativeListSnapshot;
let mockNativeListProps: {
  onRefresh?: () => void;
  onEndReached?: () => void;
  scrollPositionThresholds?: { enabled: boolean };
  onScrollPositionThresholdChange?: () => void;
};
let mockResolveVault: (value: { hideFeeInfoInHistoryList: boolean }) => void;
let mockIsNative = true;
let mockSettingsHideValue = false;
let mockCanReplaceTx = false;
let mockStatus = 'confirmed';
let mockRootLayout: ((event: LayoutChangeEvent) => void) | undefined;
let mockNativeListMounts = 0;
const mockTriggerRefresh = jest.fn();
let mockAddressesInfo: Record<string, { label?: string }> = {};
let mockRowModel: {
  address: string;
  descriptionPrefix: string;
  row: { key: string; type: string; description?: string };
};
const mockBuildHistoryActivityRow = jest.fn(
  (_params: { hideValue: boolean; tableLayout?: boolean }) => mockRowModel,
);
const mockGetVaultSettings = jest.fn<
  Promise<{ hideFeeInfoInHistoryList: boolean }>,
  unknown[]
>();

jest.mock('@onekeyfe/react-native-native-list', () => ({
  NativeList: ({
    snapshot,
    ...props
  }: {
    snapshot: NativeListSnapshot;
    onRefresh?: () => void;
    onEndReached?: () => void;
    scrollPositionThresholds?: { enabled: boolean };
    onScrollPositionThresholdChange?: () => void;
  }) => {
    mockSnapshot = snapshot;
    mockNativeListProps = props;
    React.useEffect(() => {
      mockNativeListMounts += 1;
    }, []);
    return null;
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));
jest.mock('react-native', () => ({
  View: ({
    children,
    onLayout,
  }: {
    children: React.ReactNode;
    onLayout?: (event: LayoutChangeEvent) => void;
  }) => {
    mockRootLayout = onLayout;
    return children;
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: () => null,
  ActionList: {},
  useScrollContentTabBarOffset: () => 0,
  useTheme: () => ({
    bgCaution: { val: '#eee' },
    focusRing: { val: '#ddd' },
    bgHover: { val: '#ccc' },
    gray5: { val: '#bbb' },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: {
      getVaultSettings: (...args: unknown[]) => mockGetVaultSettings(...args),
    },
    serviceToken: { getNativeToken: async () => ({ symbol: 'FIL' }) },
    serviceAccountProfile: { queryAddress: async () => ({}) },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    request: () => Promise<unknown>,
    deps: readonly unknown[],
  ) => {
    const [result, setResult] = React.useState<unknown>();
    const requestRef = React.useRef(request);
    requestRef.current = request;
    const identity = JSON.stringify(deps);
    const run = React.useCallback(async () => {
      setResult(await requestRef.current());
    }, []);
    React.useEffect(() => {
      void run();
    }, [run, identity]);
    return { result, run };
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { network: { isAllNetworks: false } },
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/historyList', () => ({
  useSearchKeyAtom: () => [''],
  useAddressesInfoAtom: () => [mockAddressesInfo],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
  useSettingsValuePersistAtom: () => [{ hideValue: mockSettingsHideValue }],
}));
jest.mock('@onekeyhq/kit/src/components/Empty', () => ({
  EmptySearch: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Empty/EmptyHistory', () => ({
  EmptyHistory: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Loading', () => ({
  HistoryLoadingView: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/TxHistoryListView', () => ({
  ListFooterComponent: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/components/TxHistoryListView/TxHistoryAddressInfo',
  () => ({ __esModule: true, default: () => null }),
);
jest.mock('@onekeyhq/kit/src/hooks/useReplaceTx', () => ({
  useReplaceTx: () => ({ canReplaceTx: mockCanReplaceTx, canCancelTx: true }),
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on() {}, off() {} },
}));
jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  formatDate: () => 'Date',
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { getLocalNetworkInfo: () => ({ logoURI: 'test-logo' }) },
}));
jest.mock('@onekeyhq/shared/src/utils/promiseUtils', () => ({
  promiseAllSettledEnhanced: async (tasks: (() => Promise<unknown>)[]) =>
    Promise.all(tasks.map((task) => task())),
}));
jest.mock('@onekeyhq/shared/src/utils/historyUtils', () => ({
  buildAddressMapInfoKey: () => 'test-address',
  getFilteredHistoryBySearchKey: ({
    history,
  }: {
    history: IAccountHistoryTx[];
  }) => history,
  getHistoryTxDisplayStatus: () => mockStatus,
  convertToSectionGroups: ({ items }: { items: IAccountHistoryTx[] }) => [
    { title: 'Date', data: items },
  ],
}));
jest.mock('../../hooks/useHomeNativeListTheme', () => ({
  useHomeNativeListTheme: () => ({}),
}));
jest.mock('../../hooks/useHomeNativeRefresh', () => ({
  useHomeNativeRefresh: () => ({
    refreshing: false,
    onRefresh: mockTriggerRefresh,
  }),
}));
jest.mock('../homeNativeListSnapshot', () => ({
  historySectionKey: () => 'section',
  prepareHomeNativeListSnapshot: (snapshot: NativeListSnapshot) => snapshot,
}));
jest.mock('./historyActivityRows', () => ({
  buildHistoryActivityRow: (params: {
    hideValue: boolean;
    tableLayout?: boolean;
  }) => mockBuildHistoryActivityRow(params),
  formatHistoryNumber: () => ({ text: 'fee', textSegments: [] }),
}));

beforeEach(() => {
  mockIsNative = true;
  mockSettingsHideValue = false;
  mockCanReplaceTx = false;
  mockStatus = 'confirmed';
  mockRootLayout = undefined;
  mockNativeListMounts = 0;
  mockAddressesInfo = {};
  mockRowModel = {
    address: '',
    descriptionPrefix: '',
    row: { key: 'test-tx', type: 'activity' },
  };
  mockTriggerRefresh.mockClear();
  mockBuildHistoryActivityRow.mockClear();
  mockGetVaultSettings.mockResolvedValue({ hideFeeInfoInHistoryList: false });
});

const history = {
  id: 'test-tx',
  decodedTx: {
    networkId: 'fil--test',
    accountId: 'test-account',
    totalFeeInNative: '1',
  },
} as unknown as IAccountHistoryTx;
const baseProps = {
  data: [history],
  initialized: true,
  frozenTopEnabled: false,
  frozenTopIdentityKey: 'test-owner',
  observeFrozenTop: false,
  onAwayFromTopChange() {},
} as IHomeHistoryListViewProps;

it('switches native rows at the root width without remounting the list', () => {
  const { rerender } = render(<NativeHistoryList {...baseProps} />);
  const rowLayout = () =>
    mockBuildHistoryActivityRow.mock.lastCall?.[0].tableLayout;
  expect(rowLayout()).toBe(false);
  act(() => {
    mockRootLayout?.({
      nativeEvent: { layout: { width: 767 } },
    } as LayoutChangeEvent);
  });
  expect(rowLayout()).toBe(false);
  act(() => {
    mockRootLayout?.({
      nativeEvent: { layout: { width: 768 } },
    } as LayoutChangeEvent);
  });
  expect(rowLayout()).toBe(true);
  act(() => {
    mockRootLayout?.({
      nativeEvent: { layout: { width: 767 } },
    } as LayoutChangeEvent);
  });
  expect(rowLayout()).toBe(false);
  expect(mockNativeListMounts).toBe(1);

  rerender(<NativeHistoryList {...baseProps} tableLayout={false} />);
  expect(mockRootLayout).toBeUndefined();
  expect(rowLayout()).toBe(false);
  rerender(<NativeHistoryList {...baseProps} tableLayout />);
  expect(rowLayout()).toBe(true);
});

it('only observes the native scroll position when requested', () => {
  const view = render(<NativeHistoryList {...baseProps} frozenTopEnabled />);
  expect(mockNativeListProps.scrollPositionThresholds?.enabled).toBe(false);
  expect(mockNativeListProps.onScrollPositionThresholdChange).toBeUndefined();

  view.rerender(
    <NativeHistoryList {...baseProps} frozenTopEnabled observeFrozenTop />,
  );
  expect(mockNativeListProps.scrollPositionThresholds?.enabled).toBe(true);
  expect(mockNativeListProps.onScrollPositionThresholdChange).toBeDefined();
  expect(mockNativeListProps.onRefresh).toBeDefined();
});

it('keeps Home defaults and disables detail refresh while hiding the leading slot', () => {
  const { rerender } = render(<NativeHistoryList {...baseProps} />);
  const activity = () =>
    mockSnapshot.rows.find((row) => row.type === 'activity') as ActivityRow;
  expect(activity().hideLeading).toBeUndefined();
  expect(mockSnapshot.capabilities?.pullToRefresh).toBe(true);
  expect(mockNativeListProps.onRefresh).toBeDefined();

  rerender(
    <NativeHistoryList
      {...baseProps}
      showIcon={false}
      refreshEnabled={false}
      hideValue
    />,
  );
  expect(activity().hideLeading).toBe(true);
  expect(activity().style?.verticalPadding).toBe(8);
  expect(mockSnapshot.capabilities?.pullToRefresh).toBe(false);
  expect(mockSnapshot.capabilities?.refreshing).toBe(false);
  expect(mockNativeListProps.onRefresh).toBeUndefined();
  expect(mockTriggerRefresh).not.toHaveBeenCalled();
  expect(mockBuildHistoryActivityRow).toHaveBeenLastCalledWith(
    expect.objectContaining({ hideValue: false }),
  );
  const rowLayout = () =>
    mockBuildHistoryActivityRow.mock.lastCall?.[0].tableLayout;
  (
    [
      [767, false],
      [768, true],
      [767, false],
    ] as const
  ).forEach(([width, expected]) => {
    act(() => {
      mockRootLayout?.({
        nativeEvent: { layout: { width } },
      } as LayoutChangeEvent);
    });
    expect(rowLayout()).toBe(expected);
    expect(activity().hideLeading).toBe(true);
    expect(mockSnapshot.capabilities?.pullToRefresh).toBe(false);
  });
  expect(mockNativeListMounts).toBe(1);

  mockSettingsHideValue = true;
  rerender(
    <NativeHistoryList
      {...baseProps}
      showIcon={false}
      refreshEnabled={false}
      hideValue
    />,
  );
  expect(mockBuildHistoryActivityRow).toHaveBeenLastCalledWith(
    expect.objectContaining({ hideValue: true }),
  );
  act(() => {
    mockRootLayout?.({
      nativeEvent: { layout: { width: 768 } },
    } as LayoutChangeEvent);
  });
  expect(rowLayout()).toBe(true);
  expect(mockBuildHistoryActivityRow).toHaveBeenLastCalledWith(
    expect.objectContaining({ hideValue: true }),
  );
});

it('preserves standalone and tab Web row slots and expands pending actions', () => {
  mockIsNative = false;
  const { rerender } = render(
    <NativeHistoryList {...baseProps} showIcon={false} />,
  );
  const activity = () =>
    mockSnapshot.rows.find((row) => row.type === 'activity') as ActivityRow;
  expect(activity().height).toBe(60);

  rerender(<NativeHistoryList {...baseProps} showIcon={false} inTabList />);
  expect(activity().height).toBe(68);

  mockStatus = 'Pending';
  mockCanReplaceTx = true;
  rerender(
    <NativeHistoryList
      {...baseProps}
      data={[{ ...history }]}
      showIcon={false}
      inTabList
    />,
  );
  expect(activity().footerActions).toHaveLength(1);
  expect(activity().height).toBeUndefined();

  mockCanReplaceTx = false;
  rerender(
    <NativeHistoryList
      {...baseProps}
      data={[{ ...history }]}
      showIcon={false}
      inTabList
    />,
  );
  expect(activity().footerActions).toHaveLength(0);
  expect(activity().height).toBe(60);
});

it.each([true, false])(
  'hides pending vault fees and applies resolved hide=%s',
  async (hidden) => {
    mockGetVaultSettings.mockImplementation(
      () =>
        new Promise((resolve) => {
          mockResolveVault = resolve;
        }),
    );
    const props = {
      ...baseProps,
      showIcon: false,
      refreshEnabled: false,
      hideValue: true,
    } as IHomeHistoryListViewProps;
    render(<NativeHistoryList {...props} />);
    act(() => {
      mockRootLayout?.({
        nativeEvent: { layout: { width: 768 } },
      } as LayoutChangeEvent);
    });
    expect(mockBuildHistoryActivityRow.mock.lastCall?.[0].tableLayout).toBe(
      true,
    );
    const fee = () =>
      (mockSnapshot.rows.find((row) => row.type === 'activity') as ActivityRow)
        .fee;
    expect(fee()?.hidden).toBe(true);
    await act(async () => {
      mockResolveVault({ hideFeeInfoInHistoryList: hidden });
    });
    expect(fee()?.hidden).toBe(hidden);
  },
);

// The address part of the description opens the address sheet. NativeList is
// told where that part starts and never reads it out of the string, so a
// label holding the separator the time uses stays one tappable label.
it('states where the description action starts instead of leaving it to the separator', () => {
  const activityRow = () =>
    mockSnapshot.rows.find((row) => row.type === 'activity') as {
      description?: string;
      descriptionActionKey?: string;
      descriptionActionStart?: number;
    };

  mockRowModel = {
    address: '0xrouter',
    descriptionPrefix: '08:48 • ',
    row: { key: 'test-tx', type: 'activity', description: '08:48 • 0x12…ab' },
  };
  mockAddressesInfo = { 'test-address': { label: 'Router • V2' } };
  const { rerender } = render(<NativeHistoryList {...baseProps} />);
  expect(activityRow()).toMatchObject({
    description: '08:48 • Router • V2',
    descriptionActionKey: 'address-info',
    descriptionActionStart: 8,
  });

  // Phone rows carry no time: the whole label is the action.
  mockRowModel = {
    address: '0xrouter',
    descriptionPrefix: '',
    row: { key: 'test-tx', type: 'activity', description: '0x12…ab' },
  };
  rerender(<NativeHistoryList {...baseProps} data={[{ ...history }]} />);
  expect(activityRow()).toMatchObject({
    description: 'Router • V2',
    descriptionActionKey: 'address-info',
    descriptionActionStart: 0,
  });

  // Without address info there is no action and no start.
  mockAddressesInfo = {};
  rerender(<NativeHistoryList {...baseProps} data={[{ ...history }]} />);
  expect(activityRow().description).toBe('0x12…ab');
  expect(activityRow().descriptionActionKey).toBeUndefined();
  expect(activityRow().descriptionActionStart).toBeUndefined();
});
