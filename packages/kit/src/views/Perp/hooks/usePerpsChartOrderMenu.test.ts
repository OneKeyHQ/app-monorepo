/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { atom, getDefaultStore } from 'jotai';

import { ActionList, Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showLimitOrderDialog } from '../components/TradingPanel/panels/LimitOrderForm';

import { usePerpsChartOrderMenu } from './usePerpsChartOrderMenu';

let mockMid: string | undefined = '82000';
const mockAssetCtxAtom = atom<
  { coin: string; ctx: { midPrice: string } } | undefined
>(undefined);
let mockSize = '1';
const mockShowTpsl = jest.fn<undefined, unknown[]>();
const mockCloseMenu = jest.fn();
const mockSourcePage = { hostKey: 'main', ownerKey: 'perps' };

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useOverlayPageScope: () => mockSourcePage,
}));

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
  useHyperliquidActions: () => ({ current: {} }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountId: 'account-1' }],
  usePerpsAccountLoadingInfoAtom: () => [{ selectAccountLoading: false }],
  usePerpsActiveAssetAtom: () => [{ coin: 'BTC', universe: { szDecimals: 5 } }],
  usePerpsActiveAssetCtxMidPriceBySource: () => undefined,
  perpsActiveAssetCtxAtom: { atom: () => mockAssetCtxAtom },
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined }),
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
    getDefaultStore().set(mockAssetCtxAtom, undefined);
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
    ['82010', 'BTC', '81990', 'perps-chart-stop-loss'],
    ['82010', 'BTC', '0', 'perps-chart-stop-loss'],
    ['0', 'ETH', '82000', undefined],
    ['0', 'BTC', '82000', 'perps-chart-stop-loss'],
  ] as const)(
    'resolves TP/SL with all-mids=%s and active %s=%s',
    (mid, coin, assetMid, action) => {
      mockMid = mid;
      getDefaultStore().set(mockAssetCtxAtom, {
        coin,
        ctx: { midPrice: assetMid },
      });
      const { result } = renderHook(() => usePerpsChartOrderMenu(true));
      expect(selectPrice(result, 81_995).map((item) => item.testID)).toEqual([
        'perps-chart-limit-order',
        ...(action ? [action] : []),
      ]);
    },
  );

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

  it.each(['position', 'all-mids', 'active-asset'] as const)(
    'revalidates %s before opening TP/SL',
    async (source) => {
      if (source === 'active-asset') {
        mockMid = undefined;
        getDefaultStore().set(mockAssetCtxAtom, {
          coin: 'BTC',
          ctx: { midPrice: '82000' },
        });
      }
      const { result, rerender } = renderHook(() =>
        usePerpsChartOrderMenu(true),
      );
      const item = selectPrice(result, 83_000)[1];
      act(() => {
        if (source === 'active-asset')
          getDefaultStore().set(mockAssetCtxAtom, {
            coin: 'BTC',
            ctx: { midPrice: '84000' },
          });
        else if (source === 'position') mockSize = '0';
        else mockMid = '84000';
      });
      rerender();
      await act(async () => {
        await item.onPress?.(mockCloseMenu);
      });
      expect(mockShowTpsl).not.toHaveBeenCalled();
      expect(Toast.error).toHaveBeenCalledWith({
        title: ETranslations.order_changed_try_again__msg,
      });
    },
  );

  it('passes the source page when opening a limit order', async () => {
    const { result } = renderHook(() => usePerpsChartOrderMenu(true));
    const limitItem = selectPrice(result, 83_000)[0];
    await act(async () => {
      await limitItem.onPress?.(mockCloseMenu);
    });
    expect(showLimitOrderDialog).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePage: mockSourcePage }),
    );
  });
});
