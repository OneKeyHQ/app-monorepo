/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { ActionList, Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePerpsChartOrderMenu } from './usePerpsChartOrderMenu';

let mockMid: string | undefined = '82000';
let mockAssetMid: string | undefined;
let mockSize = '1';
const mockShowTpsl = jest.fn<undefined, unknown[]>();
const mockCloseMenu = jest.fn();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  ActionList: { show: jest.fn(() => ({ close: mockCloseMenu })) },
  Toast: { error: jest.fn() },
  runAfterActionListClose: (close: () => void, action: () => void) => {
    close();
    action();
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { ready: true, account: { id: 'account-1' } },
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [
    { mode: 'perp', coin: 'BTC', assetId: 0, universe: { szDecimals: 5 } },
  ],
  usePerpsMidByCoin: () => mockMid,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountId: 'account-1' }],
  usePerpsAccountLoadingInfoAtom: () => [{ selectAccountLoading: false }],
  usePerpsActiveAssetCtxMidPriceBySource: () => mockAssetMid,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/spot', () => ({
  useSpotActiveAssetCtxMidPriceAtom: () => [undefined],
  useSpotActiveAssetCtxMarkPriceAtom: () => [undefined],
}));
jest.mock('./useActiveTradeDisplay', () => ({
  useActiveTradeDisplay: () => ({ displayName: 'BTCUSDC', baseName: 'BTC' }),
}));
jest.mock('./usePerpsAccountScopedActivePositions', () => ({
  usePerpsAccountScopedActivePositions: () => [
    { position: { coin: 'BTC', szi: mockSize } },
  ],
}));
jest.mock('../components/OrderInfoPanel/SetTpslModal', () => ({
  showSetTpslDialog: (...args: unknown[]) => mockShowTpsl(...args),
}));
jest.mock('../components/TradingPanel/panels/LimitOrderForm', () => ({
  showLimitOrderDialog: jest.fn(),
}));

function selectPrice(
  result: { current: ReturnType<typeof usePerpsChartOrderMenu> },
  price: number,
) {
  act(() =>
    result.current.onPriceSelect?.({ price, screenX: 100, screenY: 200 }),
  );
  const calls = jest.mocked(ActionList.show).mock.calls;
  const items = calls[calls.length - 1][0].items;
  if (!items) throw new OneKeyLocalError('Expected chart order menu items');
  return items;
}

describe('Perps chart order menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMid = '82000';
    mockAssetMid = undefined;
    mockSize = '1';
  });

  it.each([
    ['1', 83_000, 'perps-chart-take-profit'],
    ['1', 81_000, 'perps-chart-stop-loss'],
    ['-1', 83_000, 'perps-chart-stop-loss'],
    ['-1', 81_000, 'perps-chart-take-profit'],
  ])('selects the valid action for size %s at %s', (size, price, action) => {
    mockSize = size;
    const { result } = renderHook(() => usePerpsChartOrderMenu(true));
    expect(selectPrice(result, price).map((item) => item.testID)).toEqual([
      'perps-chart-limit-order',
      action,
    ]);
  });

  it.each([
    ['0', '82000'],
    ['NaN', '82000'],
    ['1', '0'],
    ['1', 'NaN'],
    ['1', '83000'],
  ])(
    'omits TP/SL without a valid position and price side: size=%s, mid=%s',
    (size, mid) => {
      mockSize = size;
      mockMid = mid;
      const { result } = renderHook(() => usePerpsChartOrderMenu(true));
      expect(selectPrice(result, 83_000).map((item) => item.testID)).toEqual([
        'perps-chart-limit-order',
      ]);
    },
  );

  it('revalidates the current position before opening TP/SL', async () => {
    const { result, rerender } = renderHook(() => usePerpsChartOrderMenu(true));
    const item = selectPrice(result, 83_000)[1];
    mockSize = '0';
    rerender();
    await act(async () => {
      await item.onPress?.(mockCloseMenu);
    });
    expect(mockShowTpsl).not.toHaveBeenCalled();
  });

  it.each(['all-mids', 'active-asset'] as const)(
    'uses %s mid for availability and revalidates it before opening TP/SL',
    async (source) => {
      if (source === 'active-asset') {
        mockMid = undefined;
        mockAssetMid = '82000';
      }
      const { result, rerender } = renderHook(() =>
        usePerpsChartOrderMenu(true),
      );
      const items = selectPrice(result, 83_000);
      expect(items.map((item) => item.testID)).toEqual([
        'perps-chart-limit-order',
        'perps-chart-take-profit',
      ]);
      if (source === 'active-asset') mockAssetMid = '84000';
      else mockMid = '84000';
      rerender();
      await act(async () => {
        await items[1].onPress?.(mockCloseMenu);
      });
      expect(mockShowTpsl).not.toHaveBeenCalled();
      expect(Toast.error).toHaveBeenCalledWith({
        title: ETranslations.order_changed_try_again__msg,
      });
    },
  );
});
