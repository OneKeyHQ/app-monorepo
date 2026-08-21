import { useCallback, useMemo } from 'react';

import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useSwapActions,
  useSwapNetworksAtom,
  useSwapProSelectTokenAtom,
  useSwapProUserSelectedTokenAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapUserSelectedTokensAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

type ISwapCarryTokenCandidate = Pick<
  ISwapToken,
  'networkId' | 'contractAddress' | 'isStock'
>;

type ISwapStableTokenSnapshot = {
  requestKey: string;
  stableTokenKeys: Set<string>;
};

export type ISwapProToSwapCarryPlan = {
  targetNetworkId?: string;
  claim: () => boolean;
  apply: () => void;
};

const EMPTY_STABLE_TOKEN_KEYS = new Set<string>();
const SWAP_STABLE_CHECK_TIMEOUT_MS = 2000;

function buildStableTokenKey({
  networkId,
  contractAddress,
}: Pick<ISwapToken, 'networkId' | 'contractAddress'>) {
  return `${networkId}:${(contractAddress ?? '').toLowerCase()}`;
}

export function buildSwapStableTokenRequestKey(
  tokens: Array<ISwapCarryTokenCandidate | undefined>,
) {
  return Array.from(
    new Set(
      tokens
        .filter(
          (token): token is ISwapCarryTokenCandidate =>
            Boolean(token?.networkId && token.contractAddress) &&
            !token?.isStock,
        )
        .map(buildStableTokenKey),
    ),
  )
    .toSorted()
    .join('|');
}

function buildStableTokenRequestList(
  tokens: Array<ISwapCarryTokenCandidate | undefined>,
) {
  const addressMap = tokens.reduce((map, token) => {
    if (!token?.networkId || !token.contractAddress || token.isStock) {
      return map;
    }
    const addresses = map.get(token.networkId) ?? new Set<string>();
    addresses.add(token.contractAddress.toLowerCase());
    map.set(token.networkId, addresses);
    return map;
  }, new Map<string, Set<string>>());

  return Array.from(addressMap.entries())
    .toSorted(([networkIdA], [networkIdB]) =>
      networkIdA.localeCompare(networkIdB),
    )
    .map(([networkId, addresses]) => ({
      networkId,
      contractAddressList: Array.from(addresses).toSorted(),
    }));
}

export function resolveSwapContextNetworkId({
  accountNetworkId,
  fromTokenNetworkId,
  isAllNetwork = false,
}: {
  accountNetworkId?: string;
  fromTokenNetworkId?: string;
  isAllNetwork?: boolean;
}) {
  return !isAllNetwork && accountNetworkId
    ? accountNetworkId
    : fromTokenNetworkId;
}

function areOptionalSwapTokensEqual(
  token1: ISwapCarryTokenCandidate | undefined,
  token2: ISwapCarryTokenCandidate | undefined,
) {
  if (!token1 || !token2) return token1 === token2;
  return equalTokenNoCaseSensitive({ token1, token2 });
}

export function isSwapCarrySnapshotCurrent({
  snapshot,
  fromToken,
  toToken,
}: {
  snapshot: {
    fromToken?: ISwapCarryTokenCandidate;
    toToken?: ISwapCarryTokenCandidate;
  };
  fromToken?: ISwapCarryTokenCandidate;
  toToken?: ISwapCarryTokenCandidate;
}) {
  return (
    areOptionalSwapTokensEqual(snapshot.fromToken, fromToken) &&
    areOptionalSwapTokensEqual(snapshot.toToken, toToken)
  );
}

/**
 * Stable-coin classification is best-effort. A timeout or failure returns an
 * empty set, which follows OK-55190's explicit treat-as-non-stable fallback.
 * The hook owns retries; this helper deliberately does not keep a foreground
 * session cache that could permanently turn a transient failure into `false`.
 */
export async function fetchSwapStableTokenKeys(
  tokens: Array<ISwapCarryTokenCandidate | undefined>,
): Promise<Set<string>> {
  const list = buildStableTokenRequestList(tokens);
  if (list.length === 0) return new Set<string>();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const { default: backgroundApiProxy } =
      await import('@onekeyhq/kit/src/background/instance/backgroundApiProxy');
    const response = await Promise.race([
      backgroundApiProxy.serviceSwap.checkStableCoinsList({ list }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('swap-stable-check-timeout')),
          SWAP_STABLE_CHECK_TIMEOUT_MS,
        );
      }),
    ]);
    const stableTokenKeys = new Set<string>();
    for (const item of response ?? []) {
      for (const result of item.results ?? []) {
        if (result.isStableCoin) {
          stableTokenKeys.add(
            buildStableTokenKey({
              networkId: item.networkId,
              contractAddress: result.contractAddress,
            }),
          );
        }
      }
    }
    return stableTokenKeys;
  } catch {
    return new Set<string>();
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/**
 * OK-55190 direction Swap -> Pro: prefer ToToken and fall back to FromToken.
 * Stable coins, stock tokens, and unsupported tokens are not carried.
 */
export function resolveSwapToProCarryToken<T extends ISwapCarryTokenCandidate>({
  toToken,
  fromToken,
  stableTokenKeys,
}: {
  toToken?: T;
  fromToken?: T;
  stableTokenKeys: ReadonlySet<string>;
}): T | undefined {
  return [toToken, fromToken].find(
    (token) =>
      token &&
      !token.isStock &&
      !stableTokenKeys.has(buildStableTokenKey(token)),
  );
}

export function checkProSupportsNetwork({
  swapNetworks,
  networkId,
}: {
  swapNetworks: ISwapNetwork[];
  networkId?: string;
}) {
  return swapNetworks.some(
    (network) => network.networkId === networkId && network.supportLimit,
  );
}

/**
 * OK-55190 direction Pro -> Swap: carry the Pro target unless it is stable,
 * unsupported, stock, or equal to Swap's FromToken. Cross-network native
 * targets are also skipped because Swap would otherwise end up from = to.
 */
export function resolveProToSwapCarryToken<T extends ISwapCarryTokenCandidate>({
  proToken,
  swapFromToken,
  swapNetworkId,
  stableTokenKeys,
  swapNetworks,
}: {
  proToken?: T;
  swapFromToken?: ISwapCarryTokenCandidate;
  swapNetworkId?: string;
  stableTokenKeys: ReadonlySet<string>;
  swapNetworks: ISwapNetwork[];
}): T | undefined {
  if (!proToken || proToken.isStock) return undefined;
  const isSwapSupported = swapNetworks.some(
    (network) =>
      network.networkId === proToken.networkId &&
      (network.supportSingleSwap || network.supportCrossChainSwap),
  );
  if (!isSwapSupported) return undefined;
  if (stableTokenKeys.has(buildStableTokenKey(proToken))) return undefined;
  if (
    equalTokenNoCaseSensitive({
      token1: swapFromToken,
      token2: proToken,
    })
  ) {
    return undefined;
  }
  if (
    swapNetworkId &&
    proToken.networkId &&
    proToken.networkId !== swapNetworkId &&
    equalTokenNoCaseSensitive({
      token1: swapDefaultSetTokens[proToken.networkId]?.fromToken,
      token2: proToken,
    })
  ) {
    return undefined;
  }
  return proToken;
}

/**
 * One-shot carry between native Swap and Pro. Classification is prefetched,
 * but a tab click never waits for it: an unsettled snapshot uses the specified
 * non-stable fallback. There is no late intent, so target-side interaction can
 * never be overwritten after the user enters the tab.
 */
export function useSwapProTokenCarry({
  accountNetworkId,
  isAllNetworkSelected = false,
}: {
  accountNetworkId?: string;
  isAllNetworkSelected?: boolean;
}) {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapNetworks] = useSwapNetworksAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapUserSelectedTokens, setSwapUserSelectedTokens] =
    useSwapUserSelectedTokensAtom();
  const [swapProUserSelectedToken] = useSwapProUserSelectedTokenAtom();
  const {
    applyProTokenCarryToSwap,
    claimProTokenCarry,
    setSwapProSelectToken,
  } = useSwapActions().current;

  const stableTokenCandidates = useMemo(
    () => [
      toToken,
      fromToken,
      swapProSelectToken,
      swapUserSelectedTokens?.toToken,
      swapUserSelectedTokens?.fromToken,
      swapProUserSelectedToken,
    ],
    [
      fromToken,
      swapProSelectToken,
      swapProUserSelectedToken,
      swapUserSelectedTokens?.fromToken,
      swapUserSelectedTokens?.toToken,
      toToken,
    ],
  );
  const stableTokenRequestKey = buildSwapStableTokenRequestKey(
    stableTokenCandidates,
  );
  const { result: stableTokenSnapshot } =
    usePromiseResult<ISwapStableTokenSnapshot>(
      async () => ({
        requestKey: stableTokenRequestKey,
        stableTokenKeys:
          platformEnv.isNative && stableTokenRequestKey
            ? await fetchSwapStableTokenKeys(stableTokenCandidates)
            : EMPTY_STABLE_TOKEN_KEYS,
      }),
      [stableTokenCandidates, stableTokenRequestKey],
      {
        checkIsFocused: true,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        undefinedResultIfReRun: true,
      },
    );
  const stableTokenKeys =
    stableTokenSnapshot?.requestKey === stableTokenRequestKey
      ? stableTokenSnapshot.stableTokenKeys
      : EMPTY_STABLE_TOKEN_KEYS;

  const carrySwapTokenToPro = useCallback(() => {
    if (!swapUserSelectedTokens) return;
    setSwapUserSelectedTokens(undefined);
    if (
      !isSwapCarrySnapshotCurrent({
        snapshot: swapUserSelectedTokens,
        fromToken,
        toToken,
      })
    ) {
      return;
    }
    const token = resolveSwapToProCarryToken({
      toToken: swapUserSelectedTokens.toToken,
      fromToken: swapUserSelectedTokens.fromToken,
      stableTokenKeys,
    });
    if (
      token &&
      checkProSupportsNetwork({
        swapNetworks,
        networkId: token.networkId,
      })
    ) {
      void setSwapProSelectToken(token);
    }
  }, [
    fromToken,
    setSwapProSelectToken,
    setSwapUserSelectedTokens,
    stableTokenKeys,
    swapNetworks,
    swapUserSelectedTokens,
    toToken,
  ]);

  const prepareProTokenCarryToSwap = useCallback(():
    | ISwapProToSwapCarryPlan
    | undefined => {
    if (!swapProUserSelectedToken) return undefined;
    const swapContextNetworkId = resolveSwapContextNetworkId({
      accountNetworkId,
      fromTokenNetworkId: fromToken?.networkId,
      isAllNetwork: isAllNetworkSelected,
    });
    const token = resolveProToSwapCarryToken({
      proToken: swapProUserSelectedToken,
      swapFromToken: fromToken,
      swapNetworkId: swapContextNetworkId,
      stableTokenKeys,
      swapNetworks,
    });
    if (!token) return undefined;

    const isCrossNetwork = Boolean(
      swapContextNetworkId && token.networkId !== swapContextNetworkId,
    );
    const nativeFromToken = isCrossNetwork
      ? swapDefaultSetTokens[token.networkId]?.fromToken
      : undefined;
    return {
      targetNetworkId: isCrossNetwork ? token.networkId : undefined,
      claim: () => claimProTokenCarry(token),
      apply: () => {
        applyProTokenCarryToSwap({
          token,
          nativeFromToken: nativeFromToken?.isNative
            ? nativeFromToken
            : undefined,
          sourceProToken: token,
        });
      },
    };
  }, [
    accountNetworkId,
    applyProTokenCarryToSwap,
    claimProTokenCarry,
    fromToken,
    isAllNetworkSelected,
    stableTokenKeys,
    swapNetworks,
    swapProUserSelectedToken,
  ]);

  return { carrySwapTokenToPro, prepareProTokenCarryToSwap };
}
