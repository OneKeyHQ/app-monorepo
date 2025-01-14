import { getNetworkIdsMap } from '../../src/config/networkIds';
import { EthereumMatic, EthereumUSDC } from '../../src/consts/addresses';
import { ESwapTabSwitchType } from '../swap/types';

import type { ISwapTokenBase } from '../swap/types';

const earnTradeDefaultSetETH = {
  'networkId': 'evm--1',
  'contractAddress': '',
  'name': 'Ethereum',
  'symbol': 'ETH',
  'decimals': 18,
  'isNative': true,
  'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
};

const earnTradeDefaultSetUSDC = {
  'networkId': 'evm--1',
  'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  'name': 'USD Coin',
  'symbol': 'USDC',
  'decimals': 6,
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
  'isNative': false,
  'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
};

export const isSupportStaking = (symbol: string) =>
  ['BTC', 'SBTC', 'ETH', 'SOL', 'APT', 'ATOM', 'MATIC', 'USDC'].includes(
    symbol.toUpperCase(),
  );

export const earnMainnetNetworkIds = [
  getNetworkIdsMap().eth,
  getNetworkIdsMap().base,
  getNetworkIdsMap().cosmoshub,
  getNetworkIdsMap().apt,
  getNetworkIdsMap().sol,
  getNetworkIdsMap().btc,
];

export function getImportFromToken({
  networkId,
  tokenAddress,
  isSupportSwap = true,
}: {
  networkId: string;
  tokenAddress: string;
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
      if (
        tokenAddress.toLowerCase() === EthereumMatic.toLowerCase() ||
        tokenAddress.toLowerCase() === EthereumUSDC.toLowerCase()
      ) {
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
