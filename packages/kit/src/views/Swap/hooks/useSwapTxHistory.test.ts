import { getSwapHistoryDisplayToAmount } from '@onekeyhq/shared/src/utils/swapHistoryUtils';
import {
  EProtocolOfExchange,
  type ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildXmrPendingHistoryItem,
  generateSwapHistoryItemForContext,
} from './useSwapTxHistory';

const mockAddSwapHistoryItem = jest.fn(async () => ({ durable: true }));
const mockRecordTaskCompleted = jest.fn(async () => undefined);

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      addSwapHistoryItem: (...args: []) => mockAddSwapHistoryItem(...args),
    },
    serviceRookieGuide: {
      recordTaskCompleted: (...args: []) => mockRecordTaskCompleted(...args),
    },
  },
}));
jest.mock('../../../states/jotai/contexts/swap', () => ({}));

const context = { swapNetworks: [], currencyInfo: { id: 'usd', symbol: '$' } };
const xmr = {
  networkId: 'xmr--0',
  contractAddress: '',
  symbol: 'XMR',
  decimals: 12,
  isNative: true,
};
const scaledToken = {
  networkId: 'sol--101',
  contractAddress: 'scaled-token-fixture',
  symbol: 'SCALED',
  decimals: 6,
  balanceMultiplier: '2',
  isNative: false,
};
const swapTxInfo: ISwapTxInfo = {
  protocol: EProtocolOfExchange.SWAP,
  accountAddress: 'sender-fixture',
  receivingAddress: 'receiver-fixture',
  sender: {
    amount: '1',
    token: xmr,
    accountInfo: { networkId: xmr.networkId },
  },
  receiver: {
    amount: '3',
    token: scaledToken,
    accountInfo: { networkId: scaledToken.networkId },
  },
  swapBuildResData: {
    orderId: 'service-order',
    ctx: { changellyOrderId: 'provider-order' },
    result: {
      fromTokenInfo: xmr,
      toTokenInfo: scaledToken,
      info: { provider: 'SwapChangelly', providerName: 'Changelly' },
      supportUrl: 'https://example.com/support',
    },
  },
};

it('keeps the receive multiplier and raw amount in the background XMR order', () => {
  const item = buildXmrPendingHistoryItem(swapTxInfo, context);
  expect(item?.baseInfo.toAmount).toBe('3');
  expect(item?.baseInfo.toToken.balanceMultiplier).toBe('2');
  expect(item?.swapInfo.supportUrl).toBe('https://example.com/support');
  expect(item && getSwapHistoryDisplayToAmount(item)).toBe('6');
});

it('does not republish an XMR history item when the UI gets the broadcast reply', async () => {
  await generateSwapHistoryItemForContext(
    { txId: 'verified-tx', swapTxInfo },
    context,
  );
  expect(mockAddSwapHistoryItem).not.toHaveBeenCalled();
  expect(mockRecordTaskCompleted).toHaveBeenCalledTimes(1);
});
