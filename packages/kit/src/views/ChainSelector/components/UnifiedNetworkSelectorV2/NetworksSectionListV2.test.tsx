/**
 * @jest-environment jsdom
 */
import type { ComponentProps, ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { act, render } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { AllNetworksManagerContext } from '../AllNetworksManager/AllNetworksManagerContext';

import NetworksSectionListV2 from './NetworksSectionListV2';

import type { IServerNetworkMatch } from '../../types';
import type { NativeListProps } from '@onekeyfe/react-native-native-list';

const mockNativeList = jest.fn((_props: NativeListProps) => null);
const mockRun = jest.fn();
const mockMissingCount = jest.fn();
const mockNetwork = (id: string): IServerNetworkMatch =>
  ({ id, name: id, isTestnet: false }) as IServerNetworkMatch;
const mockNetworks = [mockNetwork('a'), mockNetwork('b'), mockNetwork('c')];
let mockSearch = '';
let mockState = {
  enabledNetworks: { a: true } as Record<string, boolean>,
  disabledNetworks: {} as Record<string, boolean>,
};

jest.mock('@onekeyfe/react-native-native-list', () => ({
  NativeList: (props: NativeListProps) => mockNativeList(props),
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: { children?: ReactNode }) => children,
  Empty: () => null,
  SearchBar: () => null,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  isEnabledNetworksInAllNetworks: ({
    networkId,
    enabledNetworks,
  }: {
    networkId: string;
    enabledNetworks: Record<string, boolean>;
  }) => Boolean(enabledNetworks[networkId]),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAllNetwork', () => ({
  useEnabledNetworksCompatibleWithWalletIdInAllNetworks: () => ({
    enabledNetworksWithoutAccount: [{ networkId: 'a' }],
    run: mockRun,
  }),
}));
jest.mock('../../hooks/usePureChainSelectorSections', () => ({
  usePureChainSelectorSections: () => ({
    sections: [{ data: mockSearch ? [mockNetworks[1]] : mockNetworks }],
  }),
}));
jest.mock('./useNetworkListPresentationV2', () => ({
  getNetworkValueV2: () => '0',
  getNetworkTitleMatchV2: () => undefined,
  useNetworkListPresentationV2: () => ({
    nativeTheme: { rowBackground: '#ffffff' },
    formatCurrencyValue: (value: string) => ({ text: value }),
    getNetworkLeading: () => ({ kind: 'network', fallbackText: 'N' }),
  }),
}));
jest.mock('./useNetworkTooltipV2', () => ({
  useNetworkTooltipV2: () => ({}),
}));

type IContextValueV2 = ComponentProps<
  typeof AllNetworksManagerContext.Provider
>['value'];

function HarnessV2() {
  const [state, setState] = useState(mockState);
  mockState = state;
  const value = useMemo<IContextValueV2>(
    () => ({
      walletId: 'wallet',
      accountId: undefined,
      indexedAccountId: undefined,
      networks: { mainNetworks: mockNetworks, frequentlyUsedNetworks: [] },
      networksState: state,
      setNetworksState: setState,
      enabledNetworks: mockNetworks.filter(
        (network) => state.enabledNetworks[network.id],
      ),
      searchKey: mockSearch,
      setSearchKey: jest.fn(),
      isCreatingEnabledAddresses: false,
      setIsCreatingEnabledAddresses: jest.fn(),
      isCreatingMissingAddresses: false,
      setIsCreatingMissingAddresses: jest.fn(),
      missingAddressCount: 0,
      setMissingAddressCount: mockMissingCount,
      accountNetworkValues: {},
      accountDeFiOverview: {},
    }),
    [state],
  );
  return (
    <AllNetworksManagerContext.Provider value={value}>
      <NetworksSectionListV2 />
    </AllNetworksManagerContext.Provider>
  );
}

function getNativePropsV2() {
  const props = mockNativeList.mock.calls.at(-1)?.[0];
  if (!props) throw new OneKeyLocalError('NativeList did not render');
  return props;
}

describe('portfolio NativeList selection adapter V2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearch = '';
    mockState = { enabledNetworks: { a: true }, disabledNetworks: {} };
  });

  it('preserves selections outside the search result and writes both state maps', () => {
    mockSearch = 'b';
    render(<HarnessV2 />);
    expect(getNativePropsV2().snapshot.selection?.selectedKeys).toEqual([]);
    act(() => {
      getNativePropsV2().onSelectionDelta?.({
        addedKeys: ['b', 'stale-network'],
        removedKeys: [],
        source: 'row',
      });
    });
    expect(mockState.enabledNetworks).toEqual({ a: true, b: true });
    expect(mockState.disabledNetworks).toEqual({ b: false });
    expect(getNativePropsV2().snapshot.selection?.selectedKeys).toEqual(['b']);
    act(() => {
      getNativePropsV2().onSelectionDelta?.({
        addedKeys: [],
        removedKeys: ['b'],
        source: 'row',
      });
    });
    expect(mockState.enabledNetworks).toEqual({ a: true, b: false });
    expect(mockState.disabledNetworks).toEqual({ b: true });
  });

  it('deselects a partial selection before selecting all compatible networks', () => {
    render(<HarnessV2 />);
    act(() => {
      getNativePropsV2().onRowAction?.({ actionKey: 'network.toggleAll' });
    });
    expect(mockState).toEqual({
      enabledNetworks: {},
      disabledNetworks: { a: true, b: true, c: true },
    });
    act(() => {
      getNativePropsV2().onRowAction?.({ actionKey: 'network.toggleAll' });
    });
    expect(mockState).toEqual({
      enabledNetworks: { a: true, b: true, c: true },
      disabledNetworks: {},
    });
  });

  it('keeps the original missing-address computation connected to the footer', () => {
    render(<HarnessV2 />);
    expect(mockMissingCount).toHaveBeenCalledWith(1);
    expect(mockRun).toHaveBeenCalled();
    expect(getNativePropsV2().snapshot.layout.stickyHeaders).toBe(false);
    expect(
      getNativePropsV2().snapshot.rows.filter((row) => row.type === 'identity'),
    ).toHaveLength(3);
  });
});
