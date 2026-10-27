/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IDustSweepNetwork } from '@onekeyhq/shared/types/swap/dustSweep';

import {
  DustSweepNetworks,
  countWrappedRows,
  resolveCollapsedNetworkIds,
} from './DustSweepFilters';

import type { LayoutChangeEvent } from 'react-native';

const mockSelectNetwork = jest.fn();
const mockOpenChainSelector = jest.fn();
const mockLayouts = new Map<string, (event: LayoutChangeEvent) => void>();
function makeNetworks(ids: string[]): IDustSweepNetwork[] {
  return ids.map((networkId) => ({
    network: { networkId, name: networkId, symbol: 'NATIVE' },
    accountId: 'account',
    address: 'address',
    nativeToken: {
      networkId,
      contractAddress: '',
      symbol: 'NATIVE',
      decimals: 18,
    },
    tokens: [],
    balanceUsd: '1',
  }));
}
let mockNetworks = makeNetworks(['evm--1', 'evm--56']);
let mockCurrentId = mockNetworks[0].network.networkId;
let mockCanSelect = true;
jest.mock('../DustSweepProvider', () => ({
  useDustSweep: () => ({
    networks: mockNetworks,
    current: mockNetworks.find(
      (entry) => entry.network.networkId === mockCurrentId,
    ),
    canSelectNetwork: mockCanSelect,
    selectNetwork: mockSelectNetwork,
    loadStatus: 'ready',
  }),
}));
jest.mock('@onekeyhq/components', () => {
  function Box({
    children,
    testID,
    onLayout,
    flexWrap,
    flexShrink,
  }: PropsWithChildren<{
    testID?: string;
    onLayout?: (event: LayoutChangeEvent) => void;
    flexWrap?: string;
    flexShrink?: number;
  }>) {
    if (testID && onLayout) mockLayouts.set(testID, onLayout);
    return (
      <div
        data-testid={testID}
        data-flex-wrap={flexWrap}
        data-flex-shrink={flexShrink}
      >
        {children}
      </div>
    );
  }
  return {
    Button: ({
      children,
      testID,
      onPress,
    }: PropsWithChildren<{
      testID?: string;
      onPress?: () => void;
    }>) => {
      return (
        <button type="button" data-testid={testID} onClick={onPress}>
          {children}
        </button>
      );
    },
    Icon: () => null,
    SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
    Stack: Box,
    XStack: Box,
    Skeleton: () => null,
  };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));
jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatar: () => null,
  NetworkAvatarBase: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/NetworksFilterItem', () => ({
  NetworksFilterItem: ({
    testID,
    onPress,
    accessibilityLabel,
  }: {
    testID: string;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      aria-label={accessibilityLabel}
    />
  ),
}));
jest.mock(
  '@onekeyhq/kit/src/views/ChainSelector/hooks/useChainSelector',
  () => ({
    __esModule: true,
    default: () => mockOpenChainSelector,
  }),
);

function layout(testID: string, width: number) {
  act(() => {
    mockLayouts.get(testID)?.({
      nativeEvent: { layout: { x: 0, y: 0, width, height: 36 } },
    } as LayoutChangeEvent);
  });
}

// Six 100px chips in a 400px bar; the "+N" toggle is 60px, "Collapse" 80px.
function measureSixNetworks() {
  layout('dust-sweep-network-scroll', 400);
  mockNetworks.forEach((entry) =>
    layout(`dust-sweep-chip-measure-${entry.network.networkId}`, 100),
  );
  layout('dust-sweep-toggle-measure-collapsed', 60);
  layout('dust-sweep-toggle-measure-expanded', 80);
}

function visibleChipIds() {
  return screen
    .queryAllByTestId(/^dust-sweep-network-(?!toggle|scroll|measure)/)
    .map((node) =>
      node.getAttribute('data-testid')?.replace('dust-sweep-network-', ''),
    );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLayouts.clear();
  mockNetworks = makeNetworks(['evm--1', 'evm--56']);
  mockCurrentId = mockNetworks[0].network.networkId;
  mockCanSelect = true;
});

it('shows every network before measuring and selects by network id', () => {
  render(<DustSweepNetworks desktop />);
  expect(visibleChipIds()).toEqual(['evm--1', 'evm--56']);
  expect(screen.queryByTestId('dust-sweep-network-toggle')).toBeNull();
  fireEvent.click(screen.getByTestId('dust-sweep-network-evm--56'));
  expect(mockSelectNetwork).toHaveBeenCalledWith('evm--56');
});

it('folds overflow into a +N toggle and keeps the selected network', () => {
  mockNetworks = makeNetworks(['a', 'b', 'c', 'd', 'e', 'f']);
  mockCurrentId = 'f';
  render(<DustSweepNetworks desktop />);
  measureSixNetworks();
  expect(visibleChipIds()).toEqual(['a', 'b', 'f']);
  expect(screen.getByTestId('dust-sweep-network-toggle').textContent).toBe(
    '+3',
  );
});

it('keeps the toggle on the row when the selected chip is too wide', () => {
  mockNetworks = makeNetworks(['a', 'b', 'c']);
  mockCurrentId = 'c';
  render(<DustSweepNetworks desktop />);
  layout('dust-sweep-network-scroll', 200);
  layout('dust-sweep-chip-measure-a', 100);
  layout('dust-sweep-chip-measure-b', 100);
  layout('dust-sweep-chip-measure-c', 180);
  layout('dust-sweep-toggle-measure-collapsed', 60);
  layout('dust-sweep-toggle-measure-expanded', 80);
  expect(visibleChipIds()).toEqual(['c']);
  expect(screen.getByTestId('dust-sweep-network-toggle').textContent).toBe(
    '+2',
  );
  // One unwrapped row whose selected chip gives up width to the toggle.
  expect(
    screen
      .getByTestId('dust-sweep-network-toggle')
      .closest('[data-flex-wrap]')
      ?.getAttribute('data-flex-wrap'),
  ).toBe('nowrap');
  expect(
    screen
      .getByTestId('dust-sweep-chip-layout-c')
      .getAttribute('data-flex-shrink'),
  ).toBe('1');
});

it('expands downward, stays open after a pick, and folds on the toggle', () => {
  mockNetworks = makeNetworks(['a', 'b', 'c', 'd', 'e', 'f']);
  const onExtraHeightChange = jest.fn();
  render(
    <DustSweepNetworks desktop onExtraHeightChange={onExtraHeightChange} />,
  );
  measureSixNetworks();
  expect(onExtraHeightChange).toHaveBeenLastCalledWith(0);

  fireEvent.click(screen.getByTestId('dust-sweep-network-toggle'));
  expect(visibleChipIds()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  expect(screen.getByTestId('dust-sweep-network-toggle').textContent).toBe(
    'global.collapse',
  );
  // a b c | d e f | Collapse: two rows of 36 + 8 below the first
  expect(onExtraHeightChange).toHaveBeenLastCalledWith(88);

  fireEvent.click(screen.getByTestId('dust-sweep-network-e'));
  expect(mockSelectNetwork).toHaveBeenCalledWith('e');
  expect(visibleChipIds()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  expect(screen.getByTestId('dust-sweep-network-toggle').textContent).toBe(
    'global.collapse',
  );

  fireEvent.click(screen.getByTestId('dust-sweep-network-toggle'));
  expect(screen.getByTestId('dust-sweep-network-toggle').textContent).toBe(
    '+3',
  );
  expect(onExtraHeightChange).toHaveBeenLastCalledWith(0);
});

it('keeps network changes locked during execution', () => {
  mockCanSelect = false;
  render(<DustSweepNetworks desktop />);
  fireEvent.click(screen.getByTestId('dust-sweep-network-evm--56'));
  expect(mockSelectNetwork).not.toHaveBeenCalled();
});

it('retains the compact network selector menu', () => {
  render(<DustSweepNetworks />);
  expect(screen.queryByTestId('dust-sweep-network-scroll')).toBeNull();
  fireEvent.click(screen.getByTestId('dust-sweep-network-menu'));
  expect(mockOpenChainSelector).toHaveBeenCalledWith(
    expect.objectContaining({
      defaultNetworkId: 'evm--1',
      networkIds: ['evm--1', 'evm--56'],
      // The desktop chips' balances, grouped like the wallet network selector.
      networkValues: { 'evm--1': '1', 'evm--56': '1' },
      networkValueCurrency: 'usd',
      groupByNetworkValue: true,
      recentNetworksEnabled: false,
      highlightSelected: true,
    }),
  );
  expect(mockOpenChainSelector.mock.calls[0][0]).not.toHaveProperty('grouped');
});

describe('resolveCollapsedNetworkIds', () => {
  const widths = { a: 100, b: 100, c: 100, d: 100 };
  const base = {
    ids: ['a', 'b', 'c', 'd'],
    widths,
    toggleWidth: 60,
  };

  it('waits until the bar, chips and toggle are measured', () => {
    expect(
      resolveCollapsedNetworkIds({ ...base, containerWidth: 0 }),
    ).toBeUndefined();
    expect(
      resolveCollapsedNetworkIds({
        ...base,
        containerWidth: 400,
        toggleWidth: 0,
      }),
    ).toBeUndefined();
    expect(
      resolveCollapsedNetworkIds({
        ...base,
        containerWidth: 400,
        widths: { a: 100 },
      }),
    ).toBeUndefined();
  });

  it('shows everything without a toggle when one row fits', () => {
    expect(
      resolveCollapsedNetworkIds({ ...base, containerWidth: 424 }),
    ).toEqual({
      visibleIds: ['a', 'b', 'c', 'd'],
      hiddenCount: 0,
      pinnedOverflows: false,
    });
  });

  it('keeps list order and stops at the first chip that does not fit', () => {
    expect(
      resolveCollapsedNetworkIds({
        ...base,
        widths: { ...widths, b: 200 },
        containerWidth: 300,
      }),
    ).toEqual({ visibleIds: ['a'], hiddenCount: 3, pinnedOverflows: false });
  });

  it('keeps a selected network that sits in the hidden part', () => {
    expect(
      resolveCollapsedNetworkIds({
        ...base,
        containerWidth: 300,
        selectedId: 'd',
      }),
    ).toEqual({
      visibleIds: ['a', 'd'],
      hiddenCount: 2,
      pinnedOverflows: false,
    });
    expect(
      resolveCollapsedNetworkIds({
        ...base,
        containerWidth: 300,
        selectedId: 'a',
      }),
    ).toEqual({
      visibleIds: ['a', 'b'],
      hiddenCount: 2,
      pinnedOverflows: false,
    });
  });

  it('flags a selected chip too wide to share the row with the toggle', () => {
    expect(
      resolveCollapsedNetworkIds({
        ...base,
        widths: { ...widths, d: 250 },
        containerWidth: 300,
        selectedId: 'd',
      }),
    ).toEqual({ visibleIds: ['d'], hiddenCount: 3, pinnedOverflows: true });
  });
});

it('counts the rows a wrapping bar needs', () => {
  expect(countWrappedRows({ widths: [], containerWidth: 300 })).toBe(1);
  expect(countWrappedRows({ widths: [100, 100], containerWidth: 208 })).toBe(1);
  expect(
    countWrappedRows({ widths: [100, 100, 100], containerWidth: 300 }),
  ).toBe(2);
});
