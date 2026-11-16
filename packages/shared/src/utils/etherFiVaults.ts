import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EthereumCbBTC,
  EthereumEBTC,
  EthereumEETH,
  EthereumStETH,
  EthereumUSDC,
  EthereumUSDT,
  EthereumWBTC,
  EthereumWETH,
  EthereumWeETH,
} from '@onekeyhq/shared/src/consts/addresses';

type IEtherFiAsset = { symbol: string; address: string; decimals: number };
const eth = { symbol: 'ETH', address: '', decimals: 18 };
const weth = { symbol: 'WETH', address: EthereumWETH, decimals: 18 };
const stakingEthToken = { symbol: 'eETH', address: EthereumEETH, decimals: 18 };
const wrappedEthToken = {
  symbol: 'weETH',
  address: EthereumWeETH,
  decimals: 18,
};
const steth = { symbol: 'stETH', address: EthereumStETH, decimals: 18 };
const usdc = { symbol: 'USDC', address: EthereumUSDC, decimals: 6 };
const usdt = { symbol: 'USDT', address: EthereumUSDT, decimals: 6 };
const wbtc = { symbol: 'WBTC', address: EthereumWBTC, decimals: 8 };
const coinbaseBitcoinToken = {
  symbol: 'cbBTC',
  address: EthereumCbBTC,
  decimals: 8,
};
const etherFiBitcoinToken = {
  symbol: 'eBTC',
  address: EthereumEBTC,
  decimals: 8,
};

const etherFiVaults: Record<
  string,
  {
    queue: string;
    teller: string;
    decimals: number;
    inputs: IEtherFiAsset[];
    outputs: IEtherFiAsset[];
  }
> = {
  '0xf0bb20865277abd641a307ece5ee04e79073416c': {
    queue: '0x0d2df071207e18ca8638b4f04e98c53155ec2ce0',
    teller: '0x9aa79c84b79816ab920bbce20f8f74557b514734',
    decimals: 18,
    inputs: [eth, weth, stakingEthToken, wrappedEthToken, steth],
    outputs: [wrappedEthToken],
  },
  '0x08c6f91e2b681faf5e17227f2a44c307b3c1364c': {
    queue: '0x38fc1ba73b7ed289955a07d9f11a85b6e388064a',
    teller: '0x4de413a26fc24c3fc27cc983be70aa9c5c299387',
    decimals: 6,
    inputs: [usdc, usdt],
    outputs: [usdc, usdt],
  },
  '0x5f46d540b6ed704c3c8789105f30e075aa900726': {
    queue: '0x77a2fd42f8769d8063f2e75061fc200014e41edf',
    teller: '0x8ea0b382d054dbebeb1d0ae47ee4ac433c730353',
    decimals: 8,
    inputs: [wbtc, coinbaseBitcoinToken, etherFiBitcoinToken],
    outputs: [etherFiBitcoinToken],
  },
};

export function getEtherFiVaultConfig(vault?: string) {
  return vault ? etherFiVaults[vault.toLowerCase()] : undefined;
}

export function isAllowedEtherFiAsset({
  vault,
  networkId,
  direction,
  token,
}: {
  vault?: string;
  networkId: string;
  direction: 'stake' | 'unstake';
  token: {
    address: string;
    symbol: string;
    decimals: number;
    isNative?: boolean;
    networkId?: string;
  };
}) {
  const config = getEtherFiVaultConfig(vault);
  if (
    !config ||
    networkId !== getNetworkIdsMap().eth ||
    (token.networkId && token.networkId !== networkId) ||
    typeof token.symbol !== 'string' ||
    typeof token.address !== 'string'
  )
    return false;
  const assets = direction === 'stake' ? config.inputs : config.outputs;
  return assets.some(
    (asset) =>
      asset.symbol.toLowerCase() === token.symbol.toLowerCase() &&
      asset.decimals === token.decimals &&
      (asset.address
        ? !token.isNative &&
          token.address.toLowerCase() === asset.address.toLowerCase()
        : Boolean(token.isNative)),
  );
}
