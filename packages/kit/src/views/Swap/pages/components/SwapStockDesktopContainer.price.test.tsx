/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapRateDifferenceUnit } from '@onekeyhq/shared/types/swap/types';

import { ESwapStockTradeSide } from '../../hooks/swapStockChannelUtils';
import { getStockTokenFiatValue } from '../../hooks/swapStockFiatValueUtils';

import { useStockEstimatedReceiveModel } from './useStockEstimatedReceiveModel';

import type { IUseSwapStockChannelReturn } from '../../hooks/useSwapStockChannel';

let mockAmount = '100';
let mockEventId = 'event-1';
let mockEventCompleted = true;
let mockProviderKeys = ['a-one'];
let mockCurrency = 'usd';
const currencyMap: Record<string, ICurrencyItem> = {
  usd: { id: 'usd', unit: '$', name: 'US Dollar', type: ['fiat'], value: '1' },
  cny: {
    id: 'cny',
    unit: '¥',
    name: 'Chinese Yuan',
    type: ['fiat'],
    value: '6.776',
  },
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapFromTokenAmountAtom: () => [{ value: mockAmount }],
  useSwapQuoteEventErrorAtom: () => [undefined],
  useSwapQuoteEventCompletedAtom: () => [mockEventCompleted],
  useSwapQuoteEventTotalCountAtom: () => [{ eventId: mockEventId }],
  useSwapQuoteCurrentEventProviderKeysAtom: () => [mockProviderKeys],
  useSwapShouldRefreshQuoteAtom: () => [false],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd', symbol: '$' } }],
}));

jest.mock('../../hooks/useSwapStockChannel', () => ({
  ESwapStockTradeSide: { Buy: 'buy', Sell: 'sell' },
}));

jest.mock('../../hooks/useSwapStockTradeInputs', () => ({
  useSwapStockEstimatedReceiveState: ({
    forceHideQuote,
    inputTokenPrice,
    quoteResult,
    quoteLoading,
    stockChannel,
  }: {
    forceHideQuote?: boolean;
    inputTokenPrice?: { price: string; currency: string };
    quoteResult?: IFetchQuoteResult;
    quoteLoading: boolean;
    stockChannel: IUseSwapStockChannelReturn;
  }) => {
    const {
      resolveStockTradeTokenPrice,
      getStockTokenFiatValue: getReceiveFiatValue,
    } = jest.requireActual<
      typeof import('../../hooks/swapStockFiatValueUtils')
    >('../../hooks/swapStockFiatValueUtils');
    const { buildSwapRateDifference } = jest.requireActual<
      typeof import('../../utils/swapRateDifferenceUtils')
    >('../../utils/swapRateDifferenceUtils');
    const receiveToken = stockChannel.currentStockToken;
    const receiveTokenPrice = resolveStockTradeTokenPrice({
      token: receiveToken,
      quoteToken: forceHideQuote ? undefined : quoteResult?.toTokenInfo,
      stockTokenDetail: stockChannel.activeStockTokenDetail,
    });
    const receiveAmount = forceHideQuote ? '' : (quoteResult?.toAmount ?? '');
    return {
      canSelectReceiveToken: false,
      currencySymbol: mockCurrency === 'usd' ? '$' : '¥',
      isLoading: quoteLoading,
      isSellSide: false,
      isReceiveTokenPopoverOpen: false,
      onReceiveTokenPress: jest.fn(),
      quoteMatchesStockTrade: !forceHideQuote,
      rateDifference: forceHideQuote
        ? undefined
        : buildSwapRateDifference({
            fromTokenPrice: inputTokenPrice?.price,
            fromTokenCurrency: inputTokenPrice?.currency,
            toTokenPrice: receiveTokenPrice?.price,
            toTokenCurrency: receiveTokenPrice?.currency,
            instantRate: quoteResult?.instantRate,
            strictCurrencyConversion: true,
          }),
      receiveAmount,
      receiveFiatValue: getReceiveFiatValue({
        amount: receiveAmount,
        tokenPrice: receiveTokenPrice,
        targetCurrency: mockCurrency,
        currencyMap,
      }),
      receiveToken,
      receiveTokenPrice,
      setIsReceiveTokenPopoverOpen: jest.fn(),
    };
  },
}));

const pay: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};
const stock: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xstock',
  symbol: 'AAPLon',
  decimals: 18,
  isStock: true,
};
const stockChannel = {
  tradeSide: ESwapStockTradeSide.Buy,
  payToken: pay,
  currentStockToken: stock,
  fromToken: pay,
  toToken: stock,
} as IUseSwapStockChannelReturn;
const quote = {
  eventId: 'event-1',
  info: { provider: 'a', providerName: 'one' },
  fromTokenInfo: { ...pay, price: '0.98', currency: 'usd' },
  toTokenInfo: { ...stock, price: '100', currency: 'usd' },
  fromAmount: '100',
  toAmount: '0.9604',
  instantRate: '0.009604',
} as IFetchQuoteResult;

beforeEach(() => {
  mockAmount = '100';
  mockEventId = 'event-1';
  mockEventCompleted = true;
  mockProviderKeys = ['a-one'];
  mockCurrency = 'usd';
});

it('keeps quoted input, receive and impact prices together across refresh and scope changes', () => {
  const initialProps = {
    inputToken: pay,
    inputTokenPrice: { price: '1', currency: 'usd' },
    receiveDisplayScope: 'account-a:100',
    quoteMatchesAccount: true,
    quoteResult: quote,
    quoteLoading: false,
    quoteEventFetching: false,
    stockChannel,
  };
  const { result, rerender } = renderHook(useStockEstimatedReceiveModel, {
    initialProps,
  });
  expect(result.current.inputTokenPrice).toEqual({
    price: '0.98',
    currency: 'usd',
  });
  expect(result.current.receiveTokenPrice).toEqual({
    price: '100',
    currency: 'usd',
  });
  expect(result.current.receiveFiatValue).toBe('96.04');
  expect(result.current.rateDifference).toEqual({
    value: '-2.00%',
    unit: ESwapRateDifferenceUnit.DEFAULT,
  });

  mockEventId = 'event-2';
  mockEventCompleted = false;
  rerender({ ...initialProps, quoteLoading: true, quoteEventFetching: true });
  expect(result.current.inputTokenPrice).toEqual({
    price: '0.98',
    currency: 'usd',
  });
  expect(result.current.receiveTokenPrice).toEqual({
    price: '100',
    currency: 'usd',
  });
  expect(result.current.receiveFiatValue).toBe('96.04');
  expect(result.current.rateDifference).toEqual({
    value: '-2.00%',
    unit: ESwapRateDifferenceUnit.DEFAULT,
  });

  mockEventCompleted = true;
  const refreshedQuote: IFetchQuoteResult = {
    ...quote,
    eventId: 'event-2',
    fromTokenInfo: { ...pay, price: '0.97', currency: 'usd' },
    toTokenInfo: { ...stock, price: '120', currency: 'usd' },
    toAmount: '0.776',
    instantRate: '0.00776',
  };
  rerender({ ...initialProps, quoteResult: refreshedQuote });
  expect(result.current.inputTokenPrice).toEqual({
    price: '0.97',
    currency: 'usd',
  });
  expect(result.current.receiveTokenPrice).toEqual({
    price: '120',
    currency: 'usd',
  });
  expect(result.current.receiveFiatValue).toBe('93.12');
  expect(result.current.rateDifference).toEqual({
    value: '-4.00%',
    unit: ESwapRateDifferenceUnit.DEFAULT,
  });

  mockAmount = '200';
  rerender({
    ...initialProps,
    receiveDisplayScope: 'account-a:200',
    quoteLoading: true,
    quoteEventFetching: true,
  });
  expect(result.current.inputTokenPrice).toEqual({
    price: '1',
    currency: 'usd',
  });
  expect(result.current.receiveFiatValue).toBe('');
  expect(result.current.rateDifference).toBeUndefined();

  mockAmount = '100';
  mockEventId = 'event-1';
  mockEventCompleted = true;
  rerender({
    ...initialProps,
    receiveDisplayScope: 'account-b:100',
    quoteMatchesAccount: false,
  });
  expect(result.current.inputTokenPrice).toEqual({
    price: '1',
    currency: 'usd',
  });
  expect(result.current.receiveFiatValue).toBe('');
  expect(result.current.rateDifference).toBeUndefined();
});

it('does not treat an untagged quote price as if it had a known currency', () => {
  const untaggedQuote: IFetchQuoteResult = {
    ...quote,
    fromTokenInfo: { ...pay, price: '0.98' },
  };
  const { result } = renderHook(() =>
    useStockEstimatedReceiveModel({
      inputToken: pay,
      inputTokenPrice: { price: '1', currency: 'usd' },
      receiveDisplayScope: 'account-a:100',
      quoteMatchesAccount: true,
      quoteResult: untaggedQuote,
      quoteLoading: false,
      quoteEventFetching: false,
      stockChannel,
    }),
  );
  expect(result.current.inputTokenPrice).toEqual({
    price: '1',
    currency: 'usd',
  });
});

it('uses the matching USD stock detail when the receive quote price is untagged', () => {
  const untaggedQuote: IFetchQuoteResult = {
    ...quote,
    toTokenInfo: { ...stock, price: '100' },
  };
  const channelWithDetail = {
    ...stockChannel,
    activeStockTokenDetail: {
      networkId: stock.networkId,
      address: stock.contractAddress,
      price: '110',
    },
  } as IUseSwapStockChannelReturn;
  const { result } = renderHook(() =>
    useStockEstimatedReceiveModel({
      inputToken: pay,
      inputTokenPrice: { price: '1', currency: 'usd' },
      receiveDisplayScope: 'account-a:100',
      quoteMatchesAccount: true,
      quoteResult: untaggedQuote,
      quoteLoading: false,
      quoteEventFetching: false,
      stockChannel: channelWithDetail,
    }),
  );
  expect(result.current.receiveTokenPrice).toEqual({
    price: '110',
    currency: 'usd',
  });
  expect(result.current.receiveFiatValue).toBe('105.644');
});

it('retains the tagged USD quote price when the display currency switches to CNY', () => {
  const initialProps = {
    inputToken: pay,
    inputTokenPrice: { price: '1', currency: 'usd' },
    receiveDisplayScope: 'account-a:100',
    quoteMatchesAccount: true,
    quoteResult: quote,
    quoteLoading: false,
    quoteEventFetching: false,
    stockChannel,
  };
  const { result, rerender } = renderHook(useStockEstimatedReceiveModel, {
    initialProps,
  });
  expect(result.current.inputTokenPrice).toEqual({
    price: '0.98',
    currency: 'usd',
  });
  mockCurrency = 'cny';
  rerender({ ...initialProps, receiveDisplayScope: 'account-a:100:cny' });
  expect(result.current.inputTokenPrice).toEqual({
    price: '0.98',
    currency: 'usd',
  });
  expect(
    getStockTokenFiatValue({
      amount: '100',
      tokenPrice: result.current.inputTokenPrice,
      targetCurrency: 'cny',
      currencyMap,
    }),
  ).toBe('664.048');
});
