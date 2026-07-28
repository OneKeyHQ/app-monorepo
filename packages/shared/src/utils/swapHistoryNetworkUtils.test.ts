import { ENetworkStatus, type IServerNetwork } from '@onekeyhq/shared/types';
import type {
  ISwapNetwork,
  ISwapToken,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapHistoryNetworkFromServer,
  buildSwapHistoryNetworkPlaceholder,
  getSwapHistoryNetworkIdsToEnrich,
  normalizeSwapHistoryNetworkInfo,
} from './swapHistoryNetworkUtils';

const ethereumNetwork: IServerNetwork = {
  id: 'evm--1',
  impl: 'evm',
  chainId: '1',
  name: 'Ethereum',
  code: 'eth',
  shortname: 'ETH',
  shortcode: 'eth',
  symbol: 'ETH',
  logoURI: 'https://example.com/eth.png',
  decimals: 18,
  feeMeta: {
    decimals: 18,
    symbol: 'ETH',
  },
  defaultEnabled: true,
  status: ENetworkStatus.LISTED,
  isTestnet: false,
};

const dynamicNetwork: IServerNetwork = {
  ...ethereumNetwork,
  id: 'evm--4663',
  chainId: '4663',
  name: 'Robinhood',
  code: 'robinhood',
  shortname: 'Robinhood',
  shortcode: 'robinhood',
  symbol: 'ETH',
  logoURI: 'https://example.com/robinhood.png',
};

function createToken(
  networkId: string,
  symbol: string,
  networkLogoURI?: string,
): ISwapToken {
  return {
    networkId,
    networkLogoURI,
    contractAddress: `0x${symbol}`,
    decimals: 18,
    symbol,
  };
}

function createHistory({
  fromNetwork,
  toNetwork,
}: {
  fromNetwork?: ISwapNetwork;
  toNetwork?: ISwapNetwork;
} = {}): ISwapTxHistory {
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.PENDING,
    accountInfo: {
      sender: { networkId: dynamicNetwork.id },
      receiver: { networkId: ethereumNetwork.id },
    },
    baseInfo: {
      fromToken: createToken(
        dynamicNetwork.id,
        'TOKEN',
        'https://example.com/token-network.png',
      ),
      toToken: createToken(ethereumNetwork.id, 'ETH'),
      fromAmount: '1',
      toAmount: '1',
      fromNetwork,
      toNetwork,
    },
    txInfo: {
      txId: '0xtx',
      sender: '0xsender',
      receiver: '0xreceiver',
    },
    swapInfo: {
      provider: { provider: 'onekey', providerName: 'OneKey' },
      instantRate: '1',
    },
    date: { created: 1, updated: 2 },
  };
}

describe('swapHistoryNetworkUtils', () => {
  it('builds a complete snapshot from a known server network', () => {
    expect(
      buildSwapHistoryNetworkFromServer({
        network: dynamicNetwork,
        token: createToken(
          dynamicNetwork.id,
          'TOKEN',
          'https://example.com/token-network.png',
        ),
      }),
    ).toEqual({
      networkId: dynamicNetwork.id,
      name: dynamicNetwork.name,
      symbol: dynamicNetwork.symbol,
      shortcode: dynamicNetwork.shortcode,
      logoURI: dynamicNetwork.logoURI,
      backendIndex: dynamicNetwork.backendIndex,
      isAllNetworks: dynamicNetwork.isAllNetworks,
    });
  });

  it('builds a canonical placeholder without inventing display metadata', () => {
    expect(
      buildSwapHistoryNetworkPlaceholder(
        createToken(
          dynamicNetwork.id,
          'TOKEN',
          'https://example.com/token-network.png',
        ),
      ),
    ).toEqual({
      networkId: dynamicNetwork.id,
      name: '',
      symbol: '',
      shortcode: '',
      logoURI: 'https://example.com/token-network.png',
    });
  });

  it('enriches dynamic networks and preserves non-network history fields', () => {
    const history = createHistory({
      fromNetwork: buildSwapHistoryNetworkPlaceholder(
        createToken(dynamicNetwork.id, 'TOKEN'),
      ),
      toNetwork: {
        networkId: ethereumNetwork.id,
        name: ethereumNetwork.name,
        symbol: ethereumNetwork.symbol,
      },
    });

    expect(getSwapHistoryNetworkIdsToEnrich([history])).toEqual([
      dynamicNetwork.id,
    ]);

    const result = normalizeSwapHistoryNetworkInfo({
      histories: [history],
      networks: [dynamicNetwork],
    });

    expect(result.changed).toBe(true);
    expect(result.histories[0]).toMatchObject({
      date: { created: 1, updated: 2 },
      baseInfo: {
        fromNetwork: {
          networkId: dynamicNetwork.id,
          name: 'Robinhood',
          symbol: 'ETH',
          shortcode: 'robinhood',
          logoURI: 'https://example.com/robinhood.png',
        },
      },
    });
  });

  it('preserves valid same-network fields while filling missing fields', () => {
    const history = createHistory({
      fromNetwork: {
        networkId: dynamicNetwork.id,
        name: 'Saved Robinhood Name',
        symbol: '',
        logoURI: 'https://example.com/saved.png',
      },
    });

    const result = normalizeSwapHistoryNetworkInfo({
      histories: [history],
      networks: [dynamicNetwork, ethereumNetwork],
    });

    expect(result.histories[0].baseInfo.fromNetwork).toMatchObject({
      networkId: dynamicNetwork.id,
      name: 'Saved Robinhood Name',
      symbol: 'ETH',
      logoURI: 'https://example.com/saved.png',
    });
  });

  it('replaces mismatched metadata with the canonical token network', () => {
    const history = createHistory({
      fromNetwork: {
        networkId: ethereumNetwork.id,
        name: 'Ethereum',
        symbol: 'ETH',
      },
    });

    const result = normalizeSwapHistoryNetworkInfo({
      histories: [history],
      networks: [dynamicNetwork],
    });

    expect(result.histories[0].baseInfo.fromNetwork).toMatchObject({
      networkId: dynamicNetwork.id,
      name: 'Robinhood',
      symbol: 'ETH',
    });
  });

  it('canonicalizes an unknown network without displaying fake values', () => {
    const history = createHistory({
      fromNetwork: {
        networkId: ethereumNetwork.id,
        name: 'Ethereum',
        symbol: 'ETH',
      },
    });

    const result = normalizeSwapHistoryNetworkInfo({
      histories: [history],
      networks: [],
    });

    expect(result.histories[0].baseInfo.fromNetwork).toEqual({
      networkId: dynamicNetwork.id,
      name: '',
      symbol: '',
      shortcode: '',
      logoURI: 'https://example.com/token-network.png',
    });
  });

  it('returns the original references when both network snapshots are complete', () => {
    const history = createHistory({
      fromNetwork: {
        networkId: dynamicNetwork.id,
        name: 'Robinhood',
        symbol: 'ETH',
      },
      toNetwork: {
        networkId: ethereumNetwork.id,
        name: 'Ethereum',
        symbol: 'ETH',
      },
    });

    const result = normalizeSwapHistoryNetworkInfo({
      histories: [history],
      networks: [],
    });

    expect(getSwapHistoryNetworkIdsToEnrich([history])).toEqual([]);
    expect(result.changed).toBe(false);
    expect(result.histories[0]).toBe(history);
  });
});
