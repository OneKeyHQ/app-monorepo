/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View, Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Icon: () => null,
    Select: (props: Record<string, unknown>) =>
      React.createElement(View, props),
    SizableText: Text,
    XStack: View,
    YStack: View,
    useMedia: () => ({ gtMd: true }),
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('../BorrowProvider', () => ({
  ...jest.requireActual<typeof import('../borrowMarketKey')>(
    '../borrowMarketKey',
  ),
  useBorrowContext: jest.fn(),
  useBorrowMarketRequestContext: jest.fn(),
}));

import { act, render } from '@testing-library/react-native';

import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { EBorrowDataStatus } from '../borrowDataStatus';
import {
  buildBorrowMarketKey,
  useBorrowContext,
  useBorrowMarketRequestContext,
} from '../BorrowProvider';
import { BorrowTestIDs } from '../testIDs';

import { Markets } from './Markets';

const markets = ['a', 'b', 'c'].map(
  (marketAddress) =>
    ({
      marketAddress,
      networkId: 'evm--1',
      provider: 'aave',
      name: marketAddress,
      network: { logoURI: '' },
    }) as IBorrowMarketItem,
);
const rememberMarket = jest.fn();
const setRequestedMarket = jest.fn();

function setContext(
  requestedMarket: IBorrowMarketItem | null,
  market = markets[0],
  availableMarkets = markets,
) {
  jest.mocked(useBorrowContext).mockReturnValue({
    market,
    markets: availableMarkets,
    rememberMarket,
    setMarkets: jest.fn(),
    setMarket: jest.fn(),
    rememberedMarketKey: '',
    earnAccount: { data: null, loading: false, refresh: async () => undefined },
    setEarnAccount: jest.fn(),
    reserves: { data: null, loading: false, refresh: async () => undefined },
    setReserves: jest.fn(),
    borrowDataStatus: EBorrowDataStatus.Ready,
    setBorrowDataStatus: jest.fn(),
    swapConfig: { isSupportSwap: false, isSupportCrossChain: false },
    pendingTxs: [],
    setPendingTxs: jest.fn(),
    refreshAllBorrowData: async () => undefined,
    setRefreshAllBorrowData: jest.fn(),
  });
  jest.mocked(useBorrowMarketRequestContext).mockReturnValue({
    requestedMarket,
    setRequestedMarket,
  });
}

function selectMarket(screen: ReturnType<typeof render>, value: unknown) {
  const select = screen.UNSAFE_root.findByProps({
    testID: BorrowTestIDs.marketSelect,
  });
  act(() => {
    (select.props.onChange as (nextValue: unknown) => void)(value);
  });
}

describe('Markets selection intent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setContext(null);
  });

  it('cancels a pending request when the user chooses the published market', () => {
    setContext(markets[1]);
    const screen = render(<Markets />);
    selectMarket(screen, buildBorrowMarketKey(markets[0]));
    expect(rememberMarket).toHaveBeenCalledWith(markets[0]);
    expect(setRequestedMarket).toHaveBeenCalledWith(null);
  });

  it('publishes a new market request immediately', () => {
    setContext(markets[1]);
    const screen = render(<Markets />);
    selectMarket(screen, buildBorrowMarketKey(markets[2]));
    expect(rememberMarket).toHaveBeenCalledWith(markets[2]);
    expect(setRequestedMarket).toHaveBeenCalledWith(markets[2]);
  });

  it('keeps an idle current-market selection as a no-op', () => {
    const screen = render(<Markets />);
    selectMarket(screen, buildBorrowMarketKey(markets[0]));
    expect(rememberMarket).not.toHaveBeenCalled();
    expect(setRequestedMarket).not.toHaveBeenCalled();
  });

  it('uses the latest published market when Select retains its callback', () => {
    setContext(markets[1]);
    const screen = render(<Markets />);
    const retainedOnChange = screen.UNSAFE_root.findByProps({
      testID: BorrowTestIDs.marketSelect,
    }).props.onChange as (value: string) => void;
    setContext(null, markets[1]);
    screen.rerender(<Markets />);
    act(() => retainedOnChange(buildBorrowMarketKey(markets[0])));
    expect(rememberMarket).toHaveBeenCalledWith(markets[0]);
    expect(setRequestedMarket).toHaveBeenCalledWith(markets[0]);
  });

  it('clears a newer request when selection was deferred from an idle render', () => {
    const screen = render(<Markets />);
    const retainedOnChange = screen.UNSAFE_root.findByProps({
      testID: BorrowTestIDs.marketSelect,
    }).props.onChange as (value: string) => void;
    setContext(markets[1]);
    screen.rerender(<Markets />);
    act(() => retainedOnChange(buildBorrowMarketKey(markets[0])));
    expect(setRequestedMarket).toHaveBeenCalledWith(null);
  });

  it('rejects a market removed while the selector was open', () => {
    const screen = render(<Markets />);
    const retainedOnChange = screen.UNSAFE_root.findByProps({
      testID: BorrowTestIDs.marketSelect,
    }).props.onChange as (value: string) => void;
    setContext(null, markets[0], markets.slice(0, 2));
    screen.rerender(<Markets />);
    act(() => retainedOnChange(buildBorrowMarketKey(markets[2])));
    expect(rememberMarket).not.toHaveBeenCalled();
    expect(setRequestedMarket).not.toHaveBeenCalled();
  });

  it.each([undefined, true, 'removed-market'])(
    'ignores invalid selection %s',
    (value) => {
      setContext(markets[1]);
      const screen = render(<Markets />);
      selectMarket(screen, value);
      expect(rememberMarket).not.toHaveBeenCalled();
      expect(setRequestedMarket).not.toHaveBeenCalled();
    },
  );
});
