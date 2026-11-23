import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EthereumWETH } from '@onekeyhq/shared/src/consts/addresses';
import type {
  IEarnStakeType,
  IEarnTokenItem,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import { getEarnProtocol } from '../../Earn/protocols';

function getWrappedStakeTokenSpec({
  providerName,
  networkId,
}: {
  providerName: string;
  networkId: string;
}) {
  const supportsWrappedEth =
    getEarnProtocol(providerName).supportsCanonicalWrappedStakeToken();
  if (!supportsWrappedEth || networkId !== getNetworkIdsMap().eth) {
    return undefined;
  }
  return { networkId, address: EthereumWETH, decimals: 18, symbol: 'WETH' };
}

function matchesWrappedStakeToken({
  networkId,
  token,
  expected,
}: {
  networkId: string;
  token?: IToken;
  expected: {
    networkId: string;
    address: string;
    decimals: number;
    symbol: string;
  };
}) {
  return Boolean(
    networkId === expected.networkId &&
    token &&
    (!token.networkId || token.networkId === networkId) &&
    !token.isNative &&
    typeof token.symbol === 'string' &&
    typeof token.address === 'string' &&
    token.symbol.toUpperCase() === expected.symbol &&
    token.address.toLowerCase() === expected.address.toLowerCase() &&
    token.decimals === expected.decimals,
  );
}

export function isValidWrappedStakeToken({
  providerName,
  networkId,
  token,
}: {
  providerName: string;
  networkId: string;
  token?: IToken;
}) {
  const expected = getWrappedStakeTokenSpec({ providerName, networkId });
  return Boolean(
    expected && matchesWrappedStakeToken({ networkId, token, expected }),
  );
}

export function resolveWrappedStakeAsset({
  assets,
  networkId,
  providerName,
}: {
  assets: IEarnTokenItem[];
  networkId: string;
  providerName: string;
}) {
  return assets.find((asset) =>
    isValidWrappedStakeToken({ providerName, networkId, token: asset.info }),
  );
}

export function resolveEarnStakeType({
  providerName,
  vaultSymbol,
  tokenSymbol,
  tokenIsNative,
}: {
  providerName: string;
  vaultSymbol?: string;
  tokenSymbol?: string;
  tokenIsNative?: boolean;
}): IEarnStakeType | undefined {
  return getEarnProtocol(providerName).resolveStakeType({
    vaultSymbol,
    tokenSymbol,
    tokenIsNative,
  });
}

export function resolveEarnStakeRequestSymbol({
  providerName,
  protocolSymbol,
  tokenSymbol,
  tokenIsNative,
  wrappedTokenSymbol,
}: {
  providerName: string;
  protocolSymbol?: string;
  tokenSymbol?: string;
  tokenIsNative?: boolean;
  wrappedTokenSymbol?: string;
}) {
  return getEarnProtocol(providerName).resolveStakeRequestSymbol({
    protocolSymbol,
    tokenSymbol,
    tokenIsNative,
    wrappedTokenSymbol,
  });
}
