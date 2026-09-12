/**
 * @jest-environment jsdom
 */
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

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
const mockValues = { a: '2', b: '2', c: '2' };
const mockDeFiOverview = {};
const mockIntl = {
  formatMessage: ({ id }: { id: string }, values?: { count?: number }) =>
    values?.count === undefined ? id : `${id}:${values.count}`,
};
const mockGetNetworkValue = jest.fn(
  ({
    network,
    accountNetworkValues,
  }: {
    network: IServerNetworkMatch;
    accountNetworkValues: Record<string, string>;
  }) => accountNetworkValues[network.id] ?? '0',
);
const mockFormatCurrencyValue = jest.fn((value: string) => ({ text: value }));
const mockGetNetworkLeading = jest.fn(() => ({
  kind: 'network',
  fallbackText: 'N',
}));
const mockPresentation = {
  nativeTheme: { rowBackground: '#ffffff' },
  formatCurrencyValue: mockFormatCurrencyValue,
  getNetworkLeading: mockGetNetworkLeading,
};
let mockMissingNetworks = [{ networkId: 'a' }];
let mockSearch = '';
let mockIsNative = false;
let mockIsDesktop = false;
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
  useIntl: () => mockIntl,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
    get isDesktop() {
      return mockIsDesktop;
    },
  },
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
  useEnabledNetworksCompatibleWithWalletIdInAllNetworks: ({
    enabledNetworks,
  }: {
    enabledNetworks: IServerNetworkMatch[];
  }) => {
    // The shared hook already fetches when its enabled-network input changes.
    useEffect(() => {
      mockRun();
    }, [enabledNetworks]);
    return { enabledNetworksWithoutAccount: mockMissingNetworks, run: mockRun };
  },
}));
jest.mock('../../hooks/usePureChainSelectorSections', () => ({
  usePureChainSelectorSections: ({
    networks,
    searchKey,
  }: {
    networks: IServerNetworkMatch[];
    searchKey: string;
  }) => {
    const sections = useMemo(
      () =>
        searchKey
          ? [{ data: networks.filter((network) => network.id === searchKey) }]
          : [
              { title: 'Assets', totalValue: '2', data: networks.slice(0, 2) },
              { title: 'C', data: networks.slice(2) },
            ],
      [networks, searchKey],
    );
    return { sections };
  },
}));
jest.mock('./useNetworkListPresentationV2', () => ({
  getNetworkValueV2: (params: Parameters<typeof mockGetNetworkValue>[0]) =>
    mockGetNetworkValue(params),
  getNetworkTitleMatchV2: () => undefined,
  useNetworkListPresentationV2: () => mockPresentation,
}));
jest.mock('./useNetworkTooltipV2', () => ({
  useNetworkTooltipV2: () => ({}),
}));

type IContextValueV2 = ComponentProps<
  typeof AllNetworksManagerContext.Provider
>['value'];

function HarnessV2({
  networks = mockNetworks,
  values = mockValues,
  isCreatingMissingAddresses = false,
}: {
  networks?: IServerNetworkMatch[];
  values?: Record<string, string>;
  isCreatingMissingAddresses?: boolean;
}) {
  const [state, setState] = useState(mockState);
  mockState = state;
  const networkCollection = useMemo(
    () => ({
      mainNetworks: networks,
      frequentlyUsedNetworks: [],
    }),
    [networks],
  );
  const enabledNetworks = useMemo(
    () => networks.filter((network) => state.enabledNetworks[network.id]),
    [networks, state],
  );
  const value = useMemo<IContextValueV2>(
    () => ({
      walletId: 'wallet',
      accountId: undefined,
      indexedAccountId: undefined,
      networks: networkCollection,
      networksState: state,
      setNetworksState: setState,
      enabledNetworks,
      searchKey: mockSearch,
      setSearchKey: jest.fn(),
      isCreatingEnabledAddresses: false,
      setIsCreatingEnabledAddresses: jest.fn(),
      isCreatingMissingAddresses,
      setIsCreatingMissingAddresses: jest.fn(),
      missingAddressCount: 0,
      setMissingAddressCount: mockMissingCount,
      accountNetworkValues: values,
      accountDeFiOverview: mockDeFiOverview,
    }),
    [
      state,
      networkCollection,
      enabledNetworks,
      values,
      isCreatingMissingAddresses,
    ],
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
    mockIsNative = false;
    mockIsDesktop = false;
    mockMissingNetworks = [{ networkId: 'a' }];
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

  it('centers the section index in the window on native platforms', () => {
    mockIsNative = true;
    render(<HarnessV2 />);
    expect(
      getNativePropsV2().snapshot.capabilities?.sectionIndex?.centeredInWindow,
    ).toBe(true);
  });

  it('centers the section index in the window on desktop', () => {
    mockIsDesktop = true;
    render(<HarnessV2 />);
    expect(
      getNativePropsV2().snapshot.capabilities?.sectionIndex?.centeredInWindow,
    ).toBe(true);
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

  it('keeps other sections selected when the assets section is toggled', () => {
    mockState = { enabledNetworks: { a: true, c: true }, disabledNetworks: {} };
    render(<HarnessV2 />);
    const getGroupState = () => {
      const row = getNativePropsV2().snapshot.rows.find(
        (item) => item.key === 'portfolio-assets-header',
      );
      return row?.type === 'sectionHeader' ? row.checkbox?.state : undefined;
    };
    expect(getGroupState()).toBe('indeterminate');
    act(() => {
      getNativePropsV2().onSelectionDelta?.({
        addedKeys: [],
        removedKeys: ['a', 'b'],
        source: 'section',
      });
    });
    expect(getNativePropsV2().snapshot.selection?.selectedKeys).toEqual(['c']);
    expect(getGroupState()).toBe('unchecked');
    act(() => {
      getNativePropsV2().onSelectionDelta?.({
        addedKeys: ['a', 'b'],
        removedKeys: [],
        source: 'section',
      });
    });
    expect(getNativePropsV2().snapshot.selection?.selectedKeys).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(getGroupState()).toBe('checked');
    expect(mockGetNetworkValue).toHaveBeenCalledTimes(3);
  });

  it('keeps the original missing-address computation connected to the footer', () => {
    render(<HarnessV2 />);
    expect(mockMissingCount).toHaveBeenCalledWith(1);
    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(getNativePropsV2().snapshot.layout.stickyHeaders).toBe(false);
    expect(
      getNativePropsV2().snapshot.rows.filter((row) => row.type === 'identity'),
    ).toHaveLength(3);
  });

  it('changes only selection presentation when a network is checked', () => {
    render(<HarnessV2 />);
    const before = getNativePropsV2().snapshot.rows;
    expect(mockGetNetworkValue).toHaveBeenCalledTimes(3);
    expect(mockFormatCurrencyValue).toHaveBeenCalledTimes(4);
    expect(mockGetNetworkLeading).toHaveBeenCalledTimes(3);
    act(() => {
      getNativePropsV2().onSelectionDelta?.({
        addedKeys: ['b'],
        removedKeys: [],
        source: 'row',
      });
    });
    expect({
      queries: mockRun.mock.calls.length,
      values: mockGetNetworkValue.mock.calls.length,
      formatting: mockFormatCurrencyValue.mock.calls.length,
      images: mockGetNetworkLeading.mock.calls.length,
    }).toEqual({ queries: 2, values: 3, formatting: 4, images: 3 });
    const after = getNativePropsV2().snapshot.rows;
    const previousRow = before.find((row) => row.key === 'b');
    const row = after.find((item) => item.key === 'b');
    expect(row?.type === 'identity' && row.leading).toBe(
      previousRow?.type === 'identity' && previousRow.leading,
    );
    expect(row?.type === 'identity' && row.trailing).toContainEqual({
      kind: 'checkbox',
      state: 'checked',
      target: { scope: 'row' },
    });
    const header = after.find((item) => item.key === 'portfolio-assets-header');
    expect(header?.type === 'sectionHeader' && header.checkbox?.state).toBe(
      'checked',
    );
    expect(after[0].type === 'sectionHeader' && after[0].title).toContain(':2');
  });

  it('refreshes money, missing-address results, and changed network metadata', () => {
    const view = render(<HarnessV2 />);
    mockMissingNetworks = [];
    view.rerender(
      <HarnessV2
        values={{ ...mockValues, b: '8' }}
        isCreatingMissingAddresses
      />,
    );
    expect(mockMissingCount).toHaveBeenLastCalledWith(0);
    const row = getNativePropsV2().snapshot.rows.find(
      (item) => item.key === 'b',
    );
    expect(row?.type === 'identity' && row.trailing).toContainEqual({
      kind: 'value',
      text: '8',
    });
    view.rerender(<HarnessV2 networks={[mockNetworks[0], mockNetwork('d')]} />);
    expect(
      getNativePropsV2()
        .snapshot.rows.filter((item) => item.type === 'identity')
        .map((item) => item.key),
    ).toEqual(['a', 'd']);
    expect(mockRun).toHaveBeenCalledTimes(2);
  });
});
