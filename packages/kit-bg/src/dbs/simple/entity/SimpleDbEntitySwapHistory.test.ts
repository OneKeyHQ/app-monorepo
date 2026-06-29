import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { SimpleDbEntitySwapHistory } from './SimpleDbEntitySwapHistory';

const baseToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  decimals: 18,
  symbol: 'TOKEN',
};

function createToken(
  symbol: string,
  contractAddress = `0x${symbol}`,
  extra?: Partial<ISwapToken>,
): ISwapToken {
  return { ...baseToken, contractAddress, symbol, ...extra };
}

const usdc = createToken('USDC', '0xUSDC');
const stockToken = createToken('AAPLon', '0xAAPLon', { isStock: true });

function createHistoryItem({
  id,
  protocol,
  status,
  fromToken = usdc,
  toToken = usdc,
}: {
  id: string;
  protocol: EProtocolOfExchange;
  status: ESwapTxHistoryStatus;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}): ISwapTxHistory {
  return {
    protocol,
    status,
    currency: '$',
    accountInfo: {
      sender: { networkId: baseToken.networkId },
      receiver: { networkId: baseToken.networkId },
    },
    baseInfo: {
      fromToken,
      toToken,
      fromAmount: '1',
      toAmount: '1',
    },
    txInfo: {
      sender: '0xsender',
      receiver: '0xreceiver',
      txId: id,
    },
    date: { created: 1, updated: 1 },
    swapInfo: {
      instantRate: '',
      provider: { provider: 'onekey', providerName: 'OneKey' },
      orderId: id,
    },
  };
}

// Buy stock = pay stablecoin -> receive stock token (protocol echoed as SWAP).
const stockPending = createHistoryItem({
  id: 'stock-pending',
  protocol: EProtocolOfExchange.SWAP,
  status: ESwapTxHistoryStatus.PENDING,
  fromToken: usdc,
  toToken: stockToken,
});
const stockSuccess = createHistoryItem({
  id: 'stock-success',
  protocol: EProtocolOfExchange.STOCK,
  status: ESwapTxHistoryStatus.SUCCESS,
  fromToken: stockToken,
  toToken: usdc,
});
const swapPending = createHistoryItem({
  id: 'swap-pending',
  protocol: EProtocolOfExchange.SWAP,
  status: ESwapTxHistoryStatus.PENDING,
  fromToken: usdc,
  toToken: createToken('ETH'),
});
const swapSuccess = createHistoryItem({
  id: 'swap-success',
  protocol: EProtocolOfExchange.SWAP,
  status: ESwapTxHistoryStatus.SUCCESS,
  fromToken: usdc,
  toToken: createToken('ETH'),
});
// A stock token traded through a non-market channel: isStock is true, but the
// row lives in the limit / private-send surfaces and is hidden from the stock
// Order History list, so a stock "Clear" must not delete it.
const stockPrivateSend = createHistoryItem({
  id: 'stock-private-send',
  protocol: EProtocolOfExchange.PRIVATE_SEND,
  status: ESwapTxHistoryStatus.SUCCESS,
  fromToken: stockToken,
  toToken: usdc,
});
const stockLimit = createHistoryItem({
  id: 'stock-limit',
  protocol: EProtocolOfExchange.LIMIT,
  status: ESwapTxHistoryStatus.SUCCESS,
  fromToken: usdc,
  toToken: stockToken,
});
// Canceling rows are grouped under "Pending" in the list, so a pending clear
// must remove them too.
const stockCanceling = createHistoryItem({
  id: 'stock-canceling',
  protocol: EProtocolOfExchange.STOCK,
  status: ESwapTxHistoryStatus.CANCELING,
  fromToken: stockToken,
  toToken: usdc,
});

async function runDelete(
  histories: ISwapTxHistory[],
  ...args: Parameters<SimpleDbEntitySwapHistory['deleteSwapHistoryItem']>
): Promise<ISwapTxHistory[]> {
  const entity = new SimpleDbEntitySwapHistory();
  jest.spyOn(entity, 'getRawData').mockResolvedValue({ histories });
  const setRawData = jest
    .spyOn(entity, 'setRawData')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .mockResolvedValue(undefined as any);
  await entity.deleteSwapHistoryItem(...args);
  const written = setRawData.mock.calls[0]?.[0] as {
    histories: ISwapTxHistory[];
  };
  return written.histories;
}

describe('SimpleDbEntitySwapHistory.deleteSwapHistoryItem onlyStock', () => {
  const all = [stockPending, stockSuccess, swapPending, swapSuccess];

  it('onlyStock clears every stock trade and keeps swap/bridge history', async () => {
    const kept = await runDelete(all, undefined, { onlyStock: true });
    expect(kept).toEqual([swapPending, swapSuccess]);
  });

  it('onlyStock + PENDING clears only pending stock, keeps the rest', async () => {
    const kept = await runDelete(all, [ESwapTxHistoryStatus.PENDING], {
      onlyStock: true,
    });
    expect(kept).toEqual([stockSuccess, swapPending, swapSuccess]);
  });

  it('excludeStock stays the mirror: clears swap, keeps every stock trade', async () => {
    const kept = await runDelete(all, undefined, { excludeStock: true });
    expect(kept).toEqual([stockPending, stockSuccess]);
  });

  it('onlyStock + excludeProtocols keeps stock-token limit/private-send rows', async () => {
    // Mirrors the stock Order History guards: only the visible market-stock set
    // is cleared; stock-token limit / private-send rows (hidden on that panel)
    // survive instead of being silently deleted.
    const kept = await runDelete(
      [stockSuccess, stockPrivateSend, stockLimit, swapSuccess],
      undefined,
      {
        onlyStock: true,
        excludeProtocols: [
          EProtocolOfExchange.LIMIT,
          EProtocolOfExchange.PRIVATE_SEND,
        ],
      },
    );
    expect(kept).toEqual([stockPrivateSend, stockLimit, swapSuccess]);
  });

  it('pending clear with [PENDING, CANCELING] also removes canceling stock', async () => {
    const kept = await runDelete(
      [stockPending, stockCanceling, stockSuccess, swapSuccess],
      [ESwapTxHistoryStatus.PENDING, ESwapTxHistoryStatus.CANCELING],
      { onlyStock: true },
    );
    expect(kept).toEqual([stockSuccess, swapSuccess]);
  });
});
