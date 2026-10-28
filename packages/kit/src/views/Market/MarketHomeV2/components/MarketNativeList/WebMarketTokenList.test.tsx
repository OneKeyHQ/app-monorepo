/** @jest-environment jsdom */
import type { ReactNode, Ref } from 'react';

import { act, cleanup, render } from '@testing-library/react';

import { WebMarketTokenList } from './WebMarketTokenList';

import type { IMarketToken } from '../MarketTokenList/MarketTokenData';
import type { NativeListProps } from '@onekeyfe/react-native-native-list';

let mockListProps: NativeListProps;
const mockTheme = new Proxy({}, { get: () => ({ val: '#ffffff' }) });
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockWatchlist = { data: [], isMounted: true };

jest.mock('@onekeyfe/react-native-native-list', () => ({
  NativeList: (props: NativeListProps) => {
    mockListProps = props;
    return null;
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    ref,
  }: {
    children?: ReactNode;
    ref?: Ref<HTMLDivElement>;
  }) => <div ref={ref}>{children}</div>,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  LazyTooltip: () => null,
  getTokenValue: () => 0,
  useClipboard: () => ({ copyText: jest.fn() }),
  useTheme: () => mockTheme,
  useScrollContentRegistration: () => undefined,
}));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('@onekeyhq/kit/src/components/AppPager/useAppPagerPage', () => ({
  useAppPagerPage: () => ({ owner: null, isFocused: true }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [mockWatchlist],
}));
jest.mock('../../../components/watchListHooksV2', () => ({
  useWatchListV2Action: () => ({}),
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy({}, { get: (_target, key) => key }),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'standard' } }),
  },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/numberUtils', () => ({
  numberFormatAsRenderText: (value: string) => value,
}));
jest.mock('@onekeyhq/shared/src/utils/perpsUtils', () => ({
  parseDexCoin: () => ({}),
}));
jest.mock('../MarketStockList/utils', () => ({}));
jest.mock(
  '../MarketTokenList/hooks/useMarketTokenColumns/tokenAgeLabel',
  () => ({
    getTokenAgeLabel: () => undefined,
  }),
);
jest.mock('./marketNativeListRows', () => ({
  buildMarketNativeRowPatches: () => [],
}));

function token(id: string): IMarketToken {
  return {
    id,
    name: 'Fartcoin ',
    symbol: 'Fartcoin ',
    address: id,
    decimals: 9,
    price: 1,
    change24h: 2,
    marketCap: 100,
    liquidity: 10,
    transactions: 2,
    uniqueTraders: 1,
    holders: 1,
    turnover: 10,
    tokenImageUri: '',
    networkLogoUri: '',
    networkId: 'sol--101',
  };
}

describe('WebMarketTokenList SDK row identity', () => {
  afterEach(cleanup);

  it('accepts whitespace in business IDs without collapsing distinct rows', () => {
    const data = [token('foo'), token('foo '), token(' foo\n')];
    const originalIds = data.map((item) => item.id);
    render(<WebMarketTokenList data={data} columns={[]} onRow={() => ({})} />);

    const keys = mockListProps.snapshot.rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(data.length);
    for (const key of keys) {
      expect(key.length).toBeGreaterThan(0);
      expect(key.trim()).toBe(key);
      expect(key).not.toMatch(/[\r\n]/);
    }
    expect(data.map((item) => item.id)).toEqual(originalIds);
  });

  it('maps an SDK open action to the original row even when IDs differ only by whitespace', () => {
    const data = [token('foo'), token('foo ')];
    const onPress = jest.fn<void, [IMarketToken, number]>();
    const onRow = jest.fn((item: IMarketToken, index: number) => ({
      onPress: () => onPress(item, index),
    }));
    render(<WebMarketTokenList data={data} columns={[]} onRow={onRow} />);

    act(() => {
      mockListProps.onRowAction?.({
        rowKey: mockListProps.snapshot.rows[1].key,
        actionKey: 'open',
      });
    });

    expect(onRow).toHaveBeenCalledWith(data[1], 1);
    expect(onPress).toHaveBeenCalledWith(data[1], 1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reorders the intended original token and preserves its business ID', () => {
    const data = [token('foo'), token('foo '), token('bar')];
    const onDragEnd = jest.fn();
    render(
      <WebMarketTokenList
        data={data}
        columns={[]}
        onRow={() => ({})}
        draggable
        onDragEnd={onDragEnd}
      />,
    );

    act(() => {
      mockListProps.onReorder?.({
        key: mockListProps.snapshot.rows[1].key,
        fromIndex: 1,
        toIndex: 0,
      });
    });

    expect(onDragEnd).toHaveBeenCalledWith({
      data: [data[1], data[0], data[2]],
      from: 1,
      to: 0,
      dragItem: data[1],
      prevItem: undefined,
      nextItem: data[0],
    });
    expect(data.map((item) => item.id)).toEqual(['foo', 'foo ', 'bar']);
  });
});
