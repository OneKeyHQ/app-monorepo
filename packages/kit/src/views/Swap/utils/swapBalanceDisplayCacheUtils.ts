import BigNumber from 'bignumber.js';

import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
export const SWAP_BALANCE_DISPLAY_CACHE_VERSION = 1;
export const SWAP_BALANCE_DISPLAY_CACHE_MAX_ENTRIES = 48;

type ISwapBalanceDisplayToken = {
  contractAddress?: string;
  isNative?: boolean;
  networkId: string;
};

export type ISwapBalanceDisplayCacheEntry = {
  accountAddress: string;
  accountKey?: string;
  balance: string;
  contractAddress?: string;
  isNative?: boolean;
  networkId: string;
  updatedAt: number;
};

export type ISwapBalanceDisplayCache = {
  version: typeof SWAP_BALANCE_DISPLAY_CACHE_VERSION;
  entries: ISwapBalanceDisplayCacheEntry[];
};

export const EMPTY_SWAP_BALANCE_DISPLAY_CACHE: ISwapBalanceDisplayCache = {
  version: SWAP_BALANCE_DISPLAY_CACHE_VERSION,
  entries: [],
};

export function resolveSwapBalanceDisplayAccountKey({
  currentAccountKey,
  cachedAccountKey,
  cachedNetworkId,
  tokenNetworkId,
}: {
  currentAccountKey?: string;
  cachedAccountKey?: string;
  cachedNetworkId?: string;
  tokenNetworkId?: string;
}) {
  if (currentAccountKey) {
    return currentAccountKey;
  }
  if (
    cachedAccountKey &&
    cachedNetworkId &&
    cachedNetworkId === tokenNetworkId
  ) {
    return cachedAccountKey;
  }
  return undefined;
}

function normalizeAccountAddress({
  accountAddress,
  networkId,
}: {
  accountAddress: string;
  networkId: string;
}) {
  return networkUtils.isEvmNetwork({ networkId })
    ? accountAddress.toLowerCase()
    : accountAddress;
}

function normalizeDisplayBalance(balance?: string) {
  if (balance === undefined) {
    return undefined;
  }
  const balanceBN = new BigNumber(balance);
  return balanceBN.isNaN() ? undefined : balanceBN.toFixed();
}

export function resolveSwapInputDisplayBalance({
  accountAddress,
  cachedBalance,
  selectedBalance,
  tokenAccountAddress,
  tokenBalance,
  tokenNetworkId,
}: {
  accountAddress?: string;
  cachedBalance?: string;
  selectedBalance?: string;
  tokenAccountAddress?: string;
  tokenBalance?: string;
  tokenNetworkId?: string;
}) {
  if (
    accountAddress &&
    tokenAccountAddress &&
    tokenNetworkId &&
    normalizeAccountAddress({ accountAddress, networkId: tokenNetworkId }) ===
      normalizeAccountAddress({
        accountAddress: tokenAccountAddress,
        networkId: tokenNetworkId,
      })
  ) {
    const normalizedTokenBalance = normalizeDisplayBalance(tokenBalance);
    if (normalizedTokenBalance !== undefined) {
      return normalizedTokenBalance;
    }
  }

  const normalizedCachedBalance = normalizeDisplayBalance(cachedBalance);
  if (normalizedCachedBalance !== undefined) {
    return normalizedCachedBalance;
  }

  return selectedBalance ?? '';
}

function getTokenIdentityKey(token?: ISwapBalanceDisplayToken) {
  if (!token?.networkId) {
    return '';
  }
  const contractAddress = normalizeTokenContractAddress({
    networkId: token.networkId,
    contractAddress: token.contractAddress,
  });
  return `${token.networkId}:${contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

function isValidBalance(balance: unknown): balance is string {
  if (typeof balance !== 'string' || !balance) {
    return false;
  }
  const balanceBN = new BigNumber(balance);
  return balanceBN.isFinite() && !balanceBN.isNaN() && !balanceBN.isNegative();
}

function getValidEntries(cache?: ISwapBalanceDisplayCache) {
  if (
    cache?.version !== SWAP_BALANCE_DISPLAY_CACHE_VERSION ||
    !Array.isArray(cache.entries)
  ) {
    return [];
  }
  return cache.entries.filter(
    (entry) =>
      Boolean(entry?.accountAddress && entry.networkId) &&
      isValidBalance(entry.balance),
  );
}

function isEntryForToken(
  entry: ISwapBalanceDisplayCacheEntry,
  token: ISwapBalanceDisplayToken,
) {
  return (
    getTokenIdentityKey(entry) === getTokenIdentityKey(token) &&
    Boolean(getTokenIdentityKey(token))
  );
}

export function areSwapBalanceDisplayAccountKeysEquivalent(
  accountKey1?: string,
  accountKey2?: string,
) {
  if (!accountKey1 || !accountKey2) {
    return false;
  }
  if (accountKey1 === accountKey2) {
    return true;
  }

  const accountKey1Parts = accountKey1.split('|');
  const accountKey2Parts = accountKey2.split('|');
  if (accountKey1Parts.length !== 3 || accountKey2Parts.length !== 3) {
    return false;
  }

  const [walletId1, accountId1, deriveType1] = accountKey1Parts;
  const [walletId2, accountId2, deriveType2] = accountKey2Parts;
  return (
    Boolean(walletId1 || accountId1) &&
    walletId1 === walletId2 &&
    accountId1 === accountId2 &&
    (deriveType1 || 'default') === (deriveType2 || 'default')
  );
}

export function resolveSwapBalanceDisplayCacheEntry({
  accountAddress,
  accountKey,
  cache,
  token,
}: {
  accountAddress?: string;
  accountKey?: string;
  cache?: ISwapBalanceDisplayCache;
  token?: ISwapBalanceDisplayToken;
}) {
  if (!token?.networkId || (!accountAddress && !accountKey)) {
    return undefined;
  }

  return getValidEntries(cache).find((entry) => {
    if (!isEntryForToken(entry, token)) {
      return false;
    }
    // Once the concrete network account is known, it is the strongest owner
    // signal. Do not let a logical account-key match hide an address mismatch.
    if (accountAddress) {
      return (
        normalizeAccountAddress({
          accountAddress: entry.accountAddress,
          networkId: token.networkId,
        }) ===
        normalizeAccountAddress({
          accountAddress,
          networkId: token.networkId,
        })
      );
    }
    return areSwapBalanceDisplayAccountKeysEquivalent(
      entry.accountKey,
      accountKey,
    );
  });
}

export function updateSwapBalanceDisplayCache({
  accountAddress,
  accountKey,
  balance,
  cache,
  now = Date.now(),
  token,
}: {
  accountAddress?: string;
  accountKey?: string;
  balance?: string;
  cache?: ISwapBalanceDisplayCache;
  now?: number;
  token?: ISwapBalanceDisplayToken;
}): ISwapBalanceDisplayCache {
  if (!accountAddress || !token?.networkId || !isValidBalance(balance)) {
    return cache ?? EMPTY_SWAP_BALANCE_DISPLAY_CACHE;
  }

  const normalizedAddress = normalizeAccountAddress({
    accountAddress,
    networkId: token.networkId,
  });
  const existingEntry = getValidEntries(cache).find(
    (entry) =>
      isEntryForToken(entry, token) &&
      normalizeAccountAddress({
        accountAddress: entry.accountAddress,
        networkId: token.networkId,
      }) === normalizedAddress,
  );
  if (
    existingEntry?.balance === balance &&
    existingEntry.accountKey === accountKey
  ) {
    return cache ?? EMPTY_SWAP_BALANCE_DISPLAY_CACHE;
  }
  const nextEntry: ISwapBalanceDisplayCacheEntry = {
    accountAddress,
    accountKey,
    balance,
    contractAddress: token.contractAddress,
    isNative: token.isNative,
    networkId: token.networkId,
    updatedAt: now,
  };
  const remainingEntries = getValidEntries(cache).filter((entry) => {
    if (!isEntryForToken(entry, token)) {
      return true;
    }
    const entryAddress = normalizeAccountAddress({
      accountAddress: entry.accountAddress,
      networkId: token.networkId,
    });
    const sameLogicalOwner = areSwapBalanceDisplayAccountKeysEquivalent(
      entry.accountKey,
      accountKey,
    );
    return entryAddress !== normalizedAddress && !sameLogicalOwner;
  });

  return {
    version: SWAP_BALANCE_DISPLAY_CACHE_VERSION,
    entries: [nextEntry, ...remainingEntries].slice(
      0,
      SWAP_BALANCE_DISPLAY_CACHE_MAX_ENTRIES,
    ),
  };
}
