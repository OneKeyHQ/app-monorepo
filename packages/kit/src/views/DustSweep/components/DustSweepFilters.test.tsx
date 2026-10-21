/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import type { IDustSweepNetwork } from '@onekeyhq/shared/types/swap/dustSweep';

import { DustSweepNetworks } from './DustSweepFilters';

import type { LayoutChangeEvent } from 'react-native';

const mockSelectNetwork = jest.fn();
const mockOpenChainSelector = jest.fn();
const mockHandleItemLayout = jest.fn();
const mockLayouts = new Map<string, (event: LayoutChangeEvent) => void>();
const networks: IDustSweepNetwork[] = ['evm--1', 'evm--56'].map(
  (networkId) => ({
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
  }),
);
let mockCurrentId = networks[0].network.networkId;
let mockCanSelect = true;
jest.mock('../DustSweepProvider', () => ({
  useDustSweep: () => ({
    networks,
    current: networks.find(
      (entry) => entry.network.networkId === mockCurrentId,
    ),
    canSelectNetwork: mockCanSelect,
    selectNetwork: mockSelectNetwork,
    loadStatus: 'ready',
  }),
}));
jest.mock('@onekeyhq/kit/src/components/ScrollableFilterBar', () => ({
  ScrollableFilterBar: ({
    selectedItemId,
    children,
  }: PropsWithChildren<{ selectedItemId?: string }>) => (
    <div data-testid="filter-bar" data-selected={selectedItemId}>
      {children}
    </div>
  ),
  useScrollableFilterBar: () => ({ handleItemLayout: mockHandleItemLayout }),
}));
jest.mock('@onekeyhq/components', () => {
  function Box({
    children,
    testID,
    onLayout,
  }: PropsWithChildren<{
    testID?: string;
    onLayout?: (event: LayoutChangeEvent) => void;
  }>) {
    if (testID && onLayout) mockLayouts.set(testID, onLayout);
    return <div data-testid={testID}>{children}</div>;
  }
  return {
    Button: ({
      children,
      testID,
      onPress,
    }: PropsWithChildren<{
      testID: string;
      onPress?: () => void;
    }>) => {
      return (
        <button type="button" data-testid={testID} onClick={onPress}>
          {children}
        </button>
      );
    },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockLayouts.clear();
  mockCurrentId = networks[0].network.networkId;
  mockCanSelect = true;
});

it('passes the controlled selected network to the same scrolling bar as Swap', () => {
  const { rerender } = render(<DustSweepNetworks desktop />);
  expect(screen.getByTestId('filter-bar').getAttribute('data-selected')).toBe(
    'evm--1',
  );
  fireEvent.click(screen.getByTestId('dust-sweep-network-evm--56'));
  expect(mockSelectNetwork).toHaveBeenCalledWith('evm--56');
  mockCurrentId = 'evm--56';
  rerender(<DustSweepNetworks desktop />);
  expect(screen.getByTestId('filter-bar').getAttribute('data-selected')).toBe(
    'evm--56',
  );
});

it('registers chip layout using the same network id that the bar selects', () => {
  render(<DustSweepNetworks desktop />);
  const event = {
    nativeEvent: { layout: { x: 400, y: 0, width: 120, height: 36 } },
  } as LayoutChangeEvent;
  mockLayouts.get('dust-sweep-chip-layout-evm--56')?.(event);
  expect(mockHandleItemLayout).toHaveBeenCalledWith('evm--56', event);
});

it('keeps network changes locked during execution', () => {
  mockCanSelect = false;
  render(<DustSweepNetworks desktop />);
  fireEvent.click(screen.getByTestId('dust-sweep-network-evm--56'));
  expect(mockSelectNetwork).not.toHaveBeenCalled();
});

it('retains the compact network selector menu', () => {
  render(<DustSweepNetworks />);
  expect(screen.queryByTestId('filter-bar')).toBeNull();
  fireEvent.click(screen.getByTestId('dust-sweep-network-menu'));
  expect(mockOpenChainSelector).toHaveBeenCalledWith(
    expect.objectContaining({
      defaultNetworkId: 'evm--1',
      networkIds: ['evm--1', 'evm--56'],
    }),
  );
});
