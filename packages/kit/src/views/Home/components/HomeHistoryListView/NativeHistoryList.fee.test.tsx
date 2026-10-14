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
let mockResolveVault: (value: { hideFeeInfoInHistoryList: boolean }) => void;
const mockGetVaultSettings = jest.fn<
  Promise<{ hideFeeInfoInHistoryList: boolean }>,
  unknown[]
>();

jest.mock('@onekeyfe/react-native-native-list', () => ({
  NativeList: ({ snapshot }: { snapshot: NativeListSnapshot }) => {
    mockSnapshot = snapshot;
    return null;
  },
}));
jest.mock('react-native', () => ({
  View: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: () => null,
  ActionList: {},
  useScrollContentTabBarOffset: () => 0,
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
  useSettingsValuePersistAtom: () => [{ hideValue: false }],
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
  useReplaceTx: () => ({}),
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
  getHistoryTxDisplayStatus: () => 'confirmed',
  convertToSectionGroups: ({ items }: { items: IAccountHistoryTx[] }) => [
    { title: 'Date', data: items },
  ],
}));
jest.mock('../../hooks/useHomeNativeListTheme', () => ({
  useHomeNativeListTheme: () => ({}),
}));
jest.mock('../../hooks/useHomeNativeRefresh', () => ({
  useHomeNativeRefresh: () => ({ refreshing: false, onRefresh() {} }),
}));
jest.mock('../homeNativeListSnapshot', () => ({
  historySectionKey: () => 'section',
  prepareHomeNativeListSnapshot: (snapshot: NativeListSnapshot) => snapshot,
}));
jest.mock('./historyActivityRows', () => ({
  buildHistoryActivityRow: () => ({
    address: '',
    row: { key: 'test-tx', type: 'activity' },
  }),
  formatHistoryNumber: () => ({ text: 'fee', textSegments: [] }),
}));

it.each([true, false])(
  'hides pending vault fees and applies resolved hide=%s',
  async (hidden) => {
    mockGetVaultSettings.mockImplementation(
      () =>
        new Promise((resolve) => {
          mockResolveVault = resolve;
        }),
    );
    const history = {
      id: 'test-tx',
      decodedTx: {
        networkId: 'fil--test',
        accountId: 'test-account',
        totalFeeInNative: '1',
      },
    } as unknown as IAccountHistoryTx;
    const props = {
      data: [history],
      tableLayout: true,
      initialized: true,
      frozenTopEnabled: false,
      frozenTopIdentityKey: 'test-owner',
      observeFrozenTop: false,
      onAwayFromTopChange() {},
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
