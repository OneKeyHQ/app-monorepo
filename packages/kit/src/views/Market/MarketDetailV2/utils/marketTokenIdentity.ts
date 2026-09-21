import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

export function normalizeMarketNetworkId(networkId?: string) {
  const trimmed = networkId?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (trimmed.includes('--')) {
    return trimmed;
  }
  return (
    networkUtils.getNetworkIdFromShortCode({ shortCode: trimmed }) ?? trimmed
  );
}

export function normalizeMarketTokenAddress(
  address: string | undefined,
  networkId: string,
) {
  return (
    normalizeTokenContractAddress({
      networkId,
      contractAddress: address?.trim(),
    }) ?? ''
  );
}

export function hasMarketContractAddress(address?: string) {
  const value = (address ?? '').trim();
  if (!value) {
    return false;
  }
  if (value.startsWith('0x')) {
    return value.length >= 40;
  }
  // NEAR account ids (`usdt.tether-token.near`) and Move type tags.
  if (value.includes('.') || value.includes('::')) {
    return true;
  }
  return value.length >= 32;
}

export function isMarketTokenDecimalsReady(token?: {
  decimals?: number;
  decimalsResolved?: boolean;
}) {
  return (
    token?.decimalsResolved !== false &&
    typeof token?.decimals === 'number' &&
    Number.isInteger(token.decimals) &&
    token.decimals >= 0
  );
}

function isZeroHexAddress(address: string) {
  const value = address.trim().toLowerCase();
  return value.startsWith('0x') && value.length >= 40 && /^0x0+$/.test(value);
}

function isSameMarketNetwork(left?: string, right?: string) {
  const leftId = normalizeMarketNetworkId(left);
  const rightId = normalizeMarketNetworkId(right);
  const leftKnown = leftId.includes('--');
  const rightKnown = rightId.includes('--');
  if (leftKnown && rightKnown) {
    return leftId === rightId;
  }
  if (leftKnown || rightKnown) {
    return true;
  }
  const leftRaw = (left ?? '').trim().toLowerCase();
  const rightRaw = (right ?? '').trim().toLowerCase();
  return !leftRaw || !rightRaw || leftRaw === rightRaw;
}

export function isMatchingMarketTokenIdentity(
  token: {
    address?: string;
    networkId?: string;
    isNative?: boolean;
  },
  identity: {
    tokenAddress: string;
    networkId: string;
    isNative: boolean;
  },
) {
  if (!isSameMarketNetwork(token.networkId, identity.networkId)) {
    return false;
  }

  const left = (token.address ?? '').trim();
  const right = identity.tokenAddress.trim();
  const leftContract = hasMarketContractAddress(left);
  const rightContract = hasMarketContractAddress(right);
  const native = identity.isNative || Boolean(token.isNative);

  if (leftContract && rightContract) {
    const networkId =
      normalizeMarketNetworkId(identity.networkId) || identity.networkId;
    const normalizedLeft = normalizeMarketTokenAddress(left, networkId);
    const normalizedRight = normalizeMarketTokenAddress(right, networkId);
    return Boolean(
      normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
    );
  }
  const leftNetworkId = normalizeMarketNetworkId(token.networkId);
  const rightNetworkId = normalizeMarketNetworkId(identity.networkId);
  const sameConcreteNetwork =
    leftNetworkId.includes('--') &&
    rightNetworkId.includes('--') &&
    leftNetworkId === rightNetworkId;

  if (!leftContract && !rightContract) {
    if (left && right) {
      return left.toLowerCase() === right.toLowerCase();
    }
    // Empty addresses only match on the same concrete chain. A CoinGecko
    // placeholder plus a leftover native detail must not look like one token.
    return sameConcreteNetwork;
  }
  return (
    sameConcreteNetwork &&
    native &&
    (!leftContract || isZeroHexAddress(left)) &&
    (!rightContract || isZeroHexAddress(right))
  );
}
