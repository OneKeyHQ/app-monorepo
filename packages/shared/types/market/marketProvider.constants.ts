import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { getNetworkIdsMap } from '../../src/config/networkIds';
import { ESwapTabSwitchType } from '../swap/types';

const getSwapTokenMap = memoizee(() => {
  const networkIdsMap = getNetworkIdsMap();
  return {
    [networkIdsMap.btc]: {
      switchType: ESwapTabSwitchType.BRIDGE,
      contractAddress: '',
      default: {
        'contractAddress': '',
        'networkId': 'btc--0',
        'name': 'Bitcoin',
        'symbol': 'BTC',
        'decimals': 8,
        'isNative': true,
      },
      target: {
        'networkId': 'evm--1',
        'contractAddress': '',
        'name': 'Ethereum',
        'symbol': 'ETH',
        'decimals': 18,
        'isNative': true,
        'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
      },
    },
    [networkIdsMap.eth]: {
      switchType: ESwapTabSwitchType.SWAP,
      contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      default: {
        'networkId': 'evm--1',
        'contractAddress': '',
        'name': 'Ethereum',
        'symbol': 'ETH',
        'decimals': 18,
        'isNative': true,
        'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
      },
      target: {
        'networkId': 'evm--1',
        'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        'name': 'USD Coin',
        'symbol': 'USDC',
        'decimals': 6,
        'isNative': false,
        'isPopular': true,
        'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
      },
    },
    [networkIdsMap.sol]: {
      switchType: ESwapTabSwitchType.SWAP,
      contractAddress: 'So11111111111111111111111111111111111111112',
      default: {
        'networkId': 'sol--101',
        'contractAddress': '',
        'name': 'Solana',
        'symbol': 'SOL',
        'decimals': 9,
        'riskLevel': 1,
        'isNative': true,
      },
      target: {
        'networkId': 'sol--101',
        'contractAddress': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'name': 'USDC',
        'symbol': 'USDC',
        'decimals': 6,
        'isNative': false,
        'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
      },
    },
    [networkIdsMap.bsc]: {
      switchType: ESwapTabSwitchType.SWAP,
      contractAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      default: {
        'networkId': 'evm--56',
        'contractAddress': '',
        'name': 'BNB',
        'symbol': 'BNB',
        'decimals': 18,
        'riskLevel': 1,
        'isNative': true,
      },
      target: {
        'networkId': 'evm--56',
        'contractAddress': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        'name': 'USD Coin',
        'symbol': 'USDC',
        'decimals': 18,
        'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
      },
    },
    [networkIdsMap.polygon]: {
      switchType: ESwapTabSwitchType.SWAP,
      contractAddress: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      default: {
        'contractAddress': '',
        'networkId': 'evm--137',
        'name': 'Polygon',
        'symbol': 'POL',
        'decimals': 18,
        'riskLevel': 1,
        'isNative': true,
      },
      target: {
        'contractAddress': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        'networkId': 'evm--137',
        'name': 'USD Coin',
        'symbol': 'USDC',
        'decimals': 6,
        'networkLogoURI':
          'https://uni.onekey-asset.com/static/chain/polygon.png',
        'riskLevel': 1,
        'isNative': false,
      },
    },
  };
});

export const getNetworkIdBySymbol = memoizee((symbol: string) => {
  const networkIdsMap = getNetworkIdsMap();
  switch (symbol) {
    case 'btc':
      return networkIdsMap.btc;
    default:
      return undefined;
  }
});

export function getImportFromToken({
  networkId,
  tokenSymbol,
  contractAddress,
}: {
  networkId: string;
  tokenSymbol: string;
  contractAddress: string;
  isSupportSwap: boolean;
}) {
  const map = getSwapTokenMap();
  const item = map[networkId];
  if (item) {
    const isNative =
      tokenSymbol.toUpperCase() === item.default.symbol &&
      item.contractAddress === contractAddress;
    return {
      isNative,
      importFromToken: isNative ? item.target : item.default,
      swapTabSwitchType: item.switchType,
    };
  }
  return undefined;
}
