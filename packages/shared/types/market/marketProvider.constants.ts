import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import { getNetworkIdsMap } from '../../src/config/networkIds';
import { ESwapTabSwitchType } from '../swap/types';

const getSwapTokenMap = memoizee(() => {
  const networkIdsMap = getNetworkIdsMap();
  return {
    [networkIdsMap.eth]: {
      switchType: ESwapTabSwitchType.SWAP,
      contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      default: {
        'networkId': 'evm--1',
        'contractAddress': '',
        'name': 'Ethereum',
        'symbol': 'ETH',
        'decimals': 18,
        'logoURI':
          'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
        'isNative': true,
        'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
      },
      usdc: {
        'networkId': 'evm--1',
        'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        'name': 'USD Coin',
        'symbol': 'USDC',
        'decimals': 6,
        'logoURI':
          'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
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
        'logoURI':
          'https://uni-test.onekey-asset.com/server-service-onchain/sol--101/tokens/native.png',
        'riskLevel': 1,
        'isNative': true,
      },
      usdc: {
        'networkId': 'sol--101',
        'contractAddress': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'name': 'USDC',
        'symbol': 'USDC',
        'decimals': 6,
        'logoURI':
          'https://uni-test.onekey-asset.com/server-service-onchain/sol--101/tokens/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png',
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
        'logoURI':
          'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-.png',
        'riskLevel': 1,
        'isNative': true,
      },
      usdc: {
        'networkId': 'evm--56',
        'contractAddress': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        'name': 'USD Coin',
        'symbol': 'USDC',
        'decimals': 18,
        'logoURI':
          'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d-1720669239205.png',
        'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
      },
    },
  };
});

export function getImportFromToken({
  networkId,
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
    return {
      importFromToken:
        item.contractAddress === contractAddress ? item.usdc : item.default,
      swapTabSwitchType: item.switchType,
    };
  }
  return undefined;
}
