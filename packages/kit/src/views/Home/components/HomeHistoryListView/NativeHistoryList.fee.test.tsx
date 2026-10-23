import * as React from 'react';

import { act, render } from '@testing-library/react-native';

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { NativeHistoryList } from './NativeHistoryList';

import type { IHomeHistoryListViewProps } from './types';
import type {
  ActivityRow,
  NativeListSnapshot,
} from '@onekeyfe/react-native-native-list';

let mockSnapshot: NativeListSnapshot;
let mockNativeListProps: {
  onRefresh?: () => void;
  onEndReached?: () => void;
};
let mockResolveVault: (value: { hideFeeInfoInHistoryList: boolean }) => void;
let mockIsNative = true;
let mockSettingsHideValue = false;
let mockCanReplaceTx = false;
let mockStatus = 'confirmed';
const mockTriggerRefresh = jest.fn();
const mockBuildHistoryActivityRow = jest.fn(
  (_params: { hideValue: boolean }) => ({
    address: '',
    row: { key: 'test-tx', type: 'activity' },
  }),
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
  }) => {
    mockSnapshot = snapshot;
    mockNativeListProps = props;
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
  View: ({ children }: { children: React.ReactNode }) => children,
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
  useAddressesInfoAtom: () => [{}],
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
  buildHistoryActivityRow: (params: { hideValue: boolean }) =>
    mockBuildHistoryActivityRow(params),
  formatHistoryNumber: () => ({ text: 'fee', textSegments: [] }),
}));

beforeEach(() => {
  mockIsNative = true;
  mockSettingsHideValue = false;
  mockCanReplaceTx = false;
  mockStatus = 'confirmed';
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
      tableLayout: true,
    } as IHomeHistoryListViewProps;
    render(<NativeHistoryList {...props} />);
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
