import { ISwapTokenBase } from "../swap/types";

import { getNetworkIdsMap } from '../../src/config/networkIds';
import { ESwapTabSwitchType } from '../swap/types';

const earnTradeDefaultSetETH = {
  'networkId': 'evm--1',
  'contractAddress': '',
  'name': 'Ethereum',
  'symbol': 'ETH',
  'decimals': 18,
  'logoURI':
    'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
  'isNative': true,
  'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
};

const earnTradeDefaultSetUSDC = {
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
};

const earnTradeDefaultSetSOL = {
  'networkId': 'sol--101',
  'contractAddress': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'name': 'USDC',
  'symbol': 'USDC',
  'decimals': 6,
  'logoURI':
    'https://uni-test.onekey-asset.com/server-service-onchain/sol--101/tokens/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png',
  'isNative': false,
  'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
};

export function getImportFromToken({
  networkId,
  tokenSymbol,
  isSupportSwap = true,
}: {
  networkId: string;
  tokenSymbol: string;
  isSupportSwap: boolean;
}) {
  let importFromToken: ISwapTokenBase | undefined;
  let swapTabSwitchType = isSupportSwap
    ? ESwapTabSwitchType.SWAP
    : ESwapTabSwitchType.BRIDGE;
  const networkIdsMap = getNetworkIdsMap();
  switch (networkId) {
    case networkIdsMap.btc:
    case networkIdsMap.sbtc:
      importFromToken = earnTradeDefaultSetETH;
      swapTabSwitchType = ESwapTabSwitchType.BRIDGE;
      break;
    case networkIdsMap.eth:
    case networkIdsMap.holesky:
    case networkIdsMap.sepolia: {
      if (tokenSymbol === 'MATIC') {
        importFromToken = earnTradeDefaultSetETH;
      } else {
        importFromToken = earnTradeDefaultSetUSDC;
      }
      swapTabSwitchType = ESwapTabSwitchType.SWAP;
      break;
    }
    case networkIdsMap.sol: {
      importFromToken = earnTradeDefaultSetSOL;
      swapTabSwitchType = ESwapTabSwitchType.SWAP;
      break;
    }
    case networkIdsMap.apt:
      importFromToken = earnTradeDefaultSetETH;
      swapTabSwitchType = ESwapTabSwitchType.BRIDGE;
      break;
    default:
      break;
  }
  return {
    importFromToken,
    swapTabSwitchType,
  };
}
