import {
  ESwapTabSwitchType,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  isSwapProTokenBalanceRequestCurrent,
  isSwapProTradeStateOwner,
} from './useSwapPro';
import {
  handleSwapQuoteTabVisibilityChange,
  isSwapQuoteTabEffectivelyVisible,
} from './useSwapQuote';

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));

jest.mock('../../Market/hooks', () => ({
  useMarketBasicConfig: jest.fn(),
}));

jest.mock(
  '../../Market/MarketDetailV2/components/InformationTabs/components/TransactionsHistory/hooks/useTransactionsWebSocket',
  () => ({
    useTransactionsWebSocket: jest.fn(),
  }),
);

jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapInit',
  () => ({
    useSpeedSwapInit: jest.fn(),
  }),
);

jest.mock(
  '../../Market/MarketDetailV2/components/SwapPanel/hooks/useTradeType',
  () => ({
    ESwapDirection: {
      BUY: 'BUY',
      SELL: 'SELL',
    },
  }),
);

jest.mock('./useSwapAccount', () => ({
  useSwapAddressInfo: jest.fn(),
}));

jest.mock('./useSwapState', () => ({
  useSwapSlippagePercentageModeInfo: jest.fn(),
}));

const accountIdentity = {
  requestId: 2,
  currentRequestId: 2,
  requestedAccountId: 'account-1',
  requestedAccountAddress: '0xaccount1',
  currentAccountId: 'account-1',
  currentAccountAddress: '0xaccount1',
};

const token = {
  networkId: 'evm--1',
  contractAddress: '0xtoken1',
} as ISwapToken;

describe('Swap quote lifecycle visibility', () => {
  it.each([
    {
      isFocus: true,
      isHiddenModel: false,
      expected: true,
    },
    {
      isFocus: true,
      isHiddenModel: true,
      expected: false,
    },
    {
      isFocus: false,
      isHiddenModel: false,
      expected: false,
    },
    {
      isFocus: false,
      isHiddenModel: true,
      expected: false,
    },
  ])(
    'returns $expected for focus=$isFocus and hidden=$isHiddenModel',
    ({ isFocus, isHiddenModel, expected }) => {
      expect(
        isSwapQuoteTabEffectivelyVisible({
          isFocus,
          isHiddenModel,
        }),
      ).toBe(expected);
    },
  );

  it('pauses and unsubscribes while the focused tab is hidden by an overlay', () => {
    const setQuoteVisible = jest.fn();
    const subscribeQuoteEvents = jest.fn();
    const refreshPreservedInputQuote = jest.fn();
    const pauseQuote = jest.fn();
    const unsubscribeQuoteEvents = jest.fn();

    handleSwapQuoteTabVisibilityChange({
      isFocus: true,
      isHiddenModel: true,
      setQuoteVisible,
      subscribeQuoteEvents,
      refreshPreservedInputQuote,
      pauseQuote,
      unsubscribeQuoteEvents,
    });

    expect(setQuoteVisible).toHaveBeenCalledWith(false);
    expect(pauseQuote).toHaveBeenCalledTimes(1);
    expect(unsubscribeQuoteEvents).toHaveBeenCalledTimes(1);
    expect(subscribeQuoteEvents).not.toHaveBeenCalled();
    expect(refreshPreservedInputQuote).not.toHaveBeenCalled();
  });

  it('subscribes and consumes the refresh marker once the tab is visible', () => {
    const setQuoteVisible = jest.fn();
    const subscribeQuoteEvents = jest.fn();
    const refreshPreservedInputQuote = jest.fn();
    const pauseQuote = jest.fn();
    const unsubscribeQuoteEvents = jest.fn();

    handleSwapQuoteTabVisibilityChange({
      isFocus: true,
      isHiddenModel: false,
      setQuoteVisible,
      subscribeQuoteEvents,
      refreshPreservedInputQuote,
      pauseQuote,
      unsubscribeQuoteEvents,
    });

    expect(setQuoteVisible).toHaveBeenCalledWith(true);
    expect(subscribeQuoteEvents).toHaveBeenCalledTimes(1);
    expect(refreshPreservedInputQuote).toHaveBeenCalledTimes(1);
    expect(pauseQuote).not.toHaveBeenCalled();
    expect(unsubscribeQuoteEvents).not.toHaveBeenCalled();
  });
});

describe('Swap Pro trade state ownership', () => {
  it.each<readonly [boolean, boolean, ESwapTabSwitchType]>([
    [false, false, ESwapTabSwitchType.BRIDGE],
    [false, false, ESwapTabSwitchType.LIMIT],
    [true, true, ESwapTabSwitchType.LIMIT],
    [true, false, ESwapTabSwitchType.STOCK],
  ])(
    'returns %s for native=%s type=%s',
    (expected, isNative, swapTypeSwitch) => {
      expect(isSwapProTradeStateOwner({ isNative, swapTypeSwitch })).toBe(
        expected,
      );
    },
  );
});

describe('Swap Pro token balance request identity', () => {
  it('accepts a response while account, network, and token are unchanged', () => {
    expect(
      isSwapProTokenBalanceRequestCurrent({
        ...accountIdentity,
        requestedToken: token,
        currentToken: token,
      }),
    ).toBe(true);
  });

  it('rejects an older response after a newer same-identity request starts', () => {
    expect(
      isSwapProTokenBalanceRequestCurrent({
        ...accountIdentity,
        currentRequestId: accountIdentity.requestId + 1,
        requestedToken: token,
        currentToken: token,
      }),
    ).toBe(false);
  });

  it.each([
    {
      name: 'account id',
      currentAccountId: 'account-2',
      currentAccountAddress: '0xaccount1',
      currentToken: token,
    },
    {
      name: 'account address',
      currentAccountId: 'account-1',
      currentAccountAddress: '0xaccount2',
      currentToken: token,
    },
    {
      name: 'network',
      currentAccountId: 'account-1',
      currentAccountAddress: '0xaccount1',
      currentToken: {
        ...token,
        networkId: 'evm--137',
      } as ISwapToken,
    },
    {
      name: 'token contract',
      currentAccountId: 'account-1',
      currentAccountAddress: '0xaccount1',
      currentToken: {
        ...token,
        contractAddress: '0xtoken2',
      } as ISwapToken,
    },
  ])('rejects a response after the $name changes', (currentIdentity) => {
    expect(
      isSwapProTokenBalanceRequestCurrent({
        ...accountIdentity,
        requestedToken: token,
        ...currentIdentity,
      }),
    ).toBe(false);
  });
});
