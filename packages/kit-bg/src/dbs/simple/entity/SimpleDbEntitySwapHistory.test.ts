import { ENetworkStatus, type IServerNetwork } from '@onekeyhq/shared/types';
import type {
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import {
  type ISwapTxHistoryPersistList,
  SimpleDbEntitySwapHistory,
} from './SimpleDbEntitySwapHistory';

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
const dynamicToken = createToken('RHE', '0xRHE', {
  networkId: 'evm--4663',
  networkLogoURI: 'https://example.com/robinhood-token.png',
});
const dynamicNetwork: IServerNetwork = {
  id: 'evm--4663',
  impl: 'evm',
  chainId: '4663',
  name: 'Robinhood',
  code: 'robinhood',
  shortname: 'Robinhood',
  shortcode: 'robinhood',
  symbol: 'ETH',
  logoURI: 'https://example.com/robinhood.png',
  decimals: 18,
  feeMeta: { decimals: 18, symbol: 'ETH' },
  defaultEnabled: true,
  status: ENetworkStatus.LISTED,
  isTestnet: false,
};

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
  let written: ISwapTxHistoryPersistList | undefined;
  jest.spyOn(entity, 'setRawData').mockImplementation(async (dataOrBuilder) => {
    written =
      typeof dataOrBuilder === 'function'
        ? await dataOrBuilder({ histories })
        : dataOrBuilder;
    return written;
  });
  await entity.deleteSwapHistoryItem(...args);
  return written?.histories ?? [];
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

describe('SimpleDbEntitySwapHistory.repairSwapHistoryNetworkInfo', () => {
  it('does not write complete history rows', async () => {
    const history = createHistoryItem({
      id: 'complete',
      protocol: EProtocolOfExchange.SWAP,
      status: ESwapTxHistoryStatus.SUCCESS,
      fromToken: dynamicToken,
      toToken: dynamicToken,
    });
    history.baseInfo.fromNetwork = {
      networkId: dynamicNetwork.id,
      name: dynamicNetwork.name,
      symbol: dynamicNetwork.symbol,
    };
    history.baseInfo.toNetwork = history.baseInfo.fromNetwork;
    const entity = new SimpleDbEntitySwapHistory();
    jest
      .spyOn(entity, 'getRawData')
      .mockResolvedValue({ histories: [history] });
    const setRawData = jest.spyOn(entity, 'setRawData');

    const result = await entity.repairSwapHistoryNetworkInfo([dynamicNetwork]);

    expect(result).toEqual({ histories: [history], changed: false });
    expect(setRawData).not.toHaveBeenCalled();
  });

  it('repairs the current locked blob and preserves concurrent rows', async () => {
    const legacy = createHistoryItem({
      id: 'legacy',
      protocol: EProtocolOfExchange.SWAP,
      status: ESwapTxHistoryStatus.PENDING,
      fromToken: dynamicToken,
      toToken: dynamicToken,
    });
    legacy.baseInfo.fromNetwork = {
      networkId: '',
      name: '',
      symbol: '',
    };
    legacy.baseInfo.toNetwork = legacy.baseInfo.fromNetwork;
    const concurrent = createHistoryItem({
      id: 'concurrent',
      protocol: EProtocolOfExchange.SWAP,
      status: ESwapTxHistoryStatus.SUCCESS,
    });
    concurrent.baseInfo.fromNetwork = {
      networkId: baseToken.networkId,
      name: 'Ethereum',
      symbol: 'ETH',
    };
    concurrent.baseInfo.toNetwork = concurrent.baseInfo.fromNetwork;

    const entity = new SimpleDbEntitySwapHistory();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({ histories: [legacy] });
    let writtenData: ISwapTxHistoryPersistList | undefined;
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockImplementation(async (dataOrBuilder) => {
        expect(typeof dataOrBuilder).toBe('function');
        if (typeof dataOrBuilder !== 'function') {
          return dataOrBuilder;
        }
        writtenData = await dataOrBuilder({
          histories: [legacy, concurrent],
          previewReadSeeded: true,
        });
        return writtenData;
      });

    const result = await entity.repairSwapHistoryNetworkInfo([dynamicNetwork]);

    expect(setRawData).toHaveBeenCalledTimes(1);
    expect(writtenData?.previewReadSeeded).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.histories).toHaveLength(2);
    expect(result.histories[0].baseInfo.fromNetwork).toMatchObject({
      networkId: dynamicNetwork.id,
      name: dynamicNetwork.name,
      symbol: dynamicNetwork.symbol,
    });
    expect(result.histories[1]).toBe(concurrent);
  });
});

async function runUpdate(
  data: ISwapTxHistoryPersistList,
  ...args: Parameters<SimpleDbEntitySwapHistory['updateSwapHistoryItem']>
): Promise<ISwapTxHistoryPersistList | null> {
  const entity = new SimpleDbEntitySwapHistory();
  jest.spyOn(entity, 'getRawData').mockResolvedValue(data);
  let written: ISwapTxHistoryPersistList | undefined;
  jest.spyOn(entity, 'setRawData').mockImplementation(async (dataOrBuilder) => {
    written =
      typeof dataOrBuilder === 'function'
        ? await dataOrBuilder(data)
        : dataOrBuilder;
    return written;
  });
  await entity.updateSwapHistoryItem(...args);
  return written ?? null;
}

describe('SimpleDbEntitySwapHistory durable mutations', () => {
  const resolved: ISwapTxHistory = {
    ...swapPending,
    status: ESwapTxHistoryStatus.SUCCESS,
  };

  it('replaces the stored row in place', async () => {
    const written = await runUpdate(
      { histories: [swapPending, swapSuccess] },
      resolved,
    );
    expect(written?.histories).toEqual([resolved, swapSuccess]);
  });

  it('promotes a durably staged pending write', async () => {
    const written = await runUpdate(
      { histories: [swapSuccess], pendingWrites: [swapPending] },
      resolved,
    );
    expect(written).toEqual({
      histories: [resolved, swapSuccess],
      pendingWrites: [],
    });
  });

  it('leaves a cleared row deleted when a late status update arrives', async () => {
    const written = await runUpdate({ histories: [swapSuccess] }, resolved);
    expect(written).toBeNull();
  });

  it('does not revive a staged row when deletion races its status update', async () => {
    const entity = new SimpleDbEntitySwapHistory();
    let stored: ISwapTxHistoryPersistList = {
      histories: [],
      pendingWrites: [swapPending],
    };
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => stored);
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation(async (dataOrBuilder) => {
        stored =
          typeof dataOrBuilder === 'function'
            ? await dataOrBuilder(stored)
            : dataOrBuilder;
        return stored;
      });

    const deletion = entity.deleteOneSwapHistory({
      txId: resolved.txInfo.txId,
    });
    const update = entity.updateSwapHistoryItem(resolved);
    await Promise.all([deletion, update]);

    expect(stored).toEqual({ histories: [], pendingWrites: [] });
  });

  it('does not commit a staged write after that stage is deleted', async () => {
    const entity = new SimpleDbEntitySwapHistory();
    let stored: ISwapTxHistoryPersistList = {
      histories: [],
      pendingWrites: [swapPending],
    };
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => stored);
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation(async (dataOrBuilder) => {
        stored =
          typeof dataOrBuilder === 'function'
            ? await dataOrBuilder(stored)
            : dataOrBuilder;
        return stored;
      });

    await entity.deleteOneSwapHistory({ txId: swapPending.txInfo.txId });
    await entity.commitPendingSwapHistoryItem(swapPending);

    expect(stored).toEqual({ histories: [], pendingWrites: [] });
  });

  it('recovers staged pending writes after a runtime restart', async () => {
    const entity = new SimpleDbEntitySwapHistory();
    let stored: ISwapTxHistoryPersistList = {
      histories: [swapSuccess],
      pendingWrites: [swapPending],
    };
    jest.spyOn(entity, 'getRawData').mockImplementation(async () => stored);
    jest
      .spyOn(entity, 'setRawData')
      .mockImplementation(async (dataOrBuilder) => {
        stored =
          typeof dataOrBuilder === 'function'
            ? await dataOrBuilder(stored)
            : dataOrBuilder;
        return stored;
      });

    await expect(entity.recoverPendingSwapHistoryItems()).resolves.toBe(1);
    expect(stored).toEqual({
      histories: [swapPending, swapSuccess],
      pendingWrites: [],
    });
  });
});
