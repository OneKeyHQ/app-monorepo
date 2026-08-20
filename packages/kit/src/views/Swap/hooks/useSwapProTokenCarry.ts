import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';

import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapNetworksAtom,
  useSwapProSelectTokenAtom,
  useSwapProUserSelectedTokenAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToTokenAmountAtom,
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

type ISwapStableTokenLookupCache = {
  key: string;
  stableTokenKeys?: Set<string>;
};

const EMPTY_STABLE_TOKEN_KEYS = new Set<string>();

// Bounds background prewarming. Tab transitions never wait for this request;
// a pending lookup skips the one-shot carry, while a settled failure keeps
// OK-55190's treat-as-non-stable fallback.
const SWAP_STABLE_CHECK_TIMEOUT_MS = 2000;

function buildStableTokenKey({
  networkId,
  contractAddress,
}: Pick<ISwapToken, 'networkId' | 'contractAddress'>) {
  return `${networkId}:${(contractAddress ?? '').toLowerCase()}`;
}

export function buildSwapStableTokenLookupKey(
  tokens: Array<ISwapCarryTokenCandidate | undefined>,
) {
  return tokens
    .filter(
      (token): token is ISwapCarryTokenCandidate =>
        Boolean(token?.networkId) && !token?.isStock,
    )
    .map(buildStableTokenKey)
    .toSorted()
    .join('|');
}

export function getSwapStableTokenKeysForCarry({
  tokens,
  cache,
}: {
  tokens: Array<ISwapCarryTokenCandidate | undefined>;
  cache?: ISwapStableTokenLookupCache;
}) {
  const key = buildSwapStableTokenLookupKey(tokens);
  if (cache?.key === key && cache.stableTokenKeys) {
    return cache.stableTokenKeys;
  }
  return undefined;
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

/**
 * OK-55190: resolves the stable-coin set for the given tokens. Any request
 * failure or timeout resolves to an empty set so the caller treats tokens
 * as non-stable instead of blocking the carry-over flow.
 */
export async function fetchSwapStableTokenKeys(
  tokens: Array<ISwapCarryTokenCandidate | undefined>,
): Promise<Set<string>> {
  const candidates = tokens.filter(
    (token): token is ISwapCarryTokenCandidate =>
      Boolean(token?.networkId) && !token?.isStock,
  );
  if (candidates.length === 0) return new Set<string>();

  const list = Array.from(
    candidates
      .reduce((map, token) => {
        const addresses = map.get(token.networkId) ?? [];
        const address = (token.contractAddress ?? '').toLowerCase();
        if (address && !addresses.includes(address)) {
          addresses.push(address);
        }
        map.set(token.networkId, addresses);
        return map;
      }, new Map<string, string[]>())
      .entries(),
  )
    .filter(([, contractAddressList]) => contractAddressList.length > 0)
    .map(([networkId, contractAddressList]) => ({
      networkId,
      contractAddressList,
    }));
  if (list.length === 0) return new Set<string>();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    // Imported lazily so pure rule helpers stay unit-testable without the
    // full background API module graph.
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

function warmSwapStableTokenKeys(
  tokens: Array<ISwapCarryTokenCandidate | undefined>,
  cacheRef: MutableRefObject<ISwapStableTokenLookupCache | undefined>,
) {
  const key = buildSwapStableTokenLookupKey(tokens);
  if (cacheRef.current?.key === key) return;
  if (!key) {
    cacheRef.current = { key, stableTokenKeys: EMPTY_STABLE_TOKEN_KEYS };
    return;
  }
  cacheRef.current = { key };
  void fetchSwapStableTokenKeys(tokens).then((stableTokenKeys) => {
    if (cacheRef.current?.key === key) {
      cacheRef.current = { key, stableTokenKeys };
    }
  });
}

/**
 * OK-55190 direction Swap -> Pro: pick the token carried into Pro.
 * Priority: ToToken, then FromToken; stable coins and stock tokens are
 * skipped. Returns undefined when both candidates are stable/invalid.
 */
export function resolveSwapToProCarryToken<T extends ISwapCarryTokenCandidate>({
  toToken,
  fromToken,
  stableTokenKeys,
}: {
  toToken?: T;
  fromToken?: T;
  stableTokenKeys: Set<string>;
}): T | undefined {
  const candidate =
    [toToken, fromToken].find(
      (token) =>
        token &&
        !token.isStock &&
        !stableTokenKeys.has(buildStableTokenKey(token)),
    ) ?? undefined;
  return candidate;
}

export function checkProSupportsNetwork({
  swapNetworks,
  networkId,
}: {
  swapNetworks: ISwapNetwork[];
  networkId?: string;
}) {
  return swapNetworks.some(
    (net) => net.networkId === networkId && net.supportLimit,
  );
}

/**
 * OK-55190 direction Pro -> Swap: the Pro target token is carried back as
 * the Swap ToToken unless it is stable, unsupported, or already the Swap
 * FromToken (avoids from = to). `swapNetworkId` is the network Swap
 * currently sits on (account network), not the FromToken's network — the
 * FromToken can be unset right after a cold start.
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
  stableTokenKeys: Set<string>;
  swapNetworks: ISwapNetwork[];
}): T | undefined {
  if (!proToken || proToken.isStock) return undefined;
  const isSwapSupported = swapNetworks.some(
    (net) =>
      net.networkId === proToken.networkId &&
      (net.supportSingleSwap || net.supportCrossChainSwap),
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
  // Cross-network carry resets FromToken to the target network's native
  // coin; a target that IS that native coin would end up from = to, so keep
  // the target mode's state instead.
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
 * OK-55190: one-shot token carry-over between ordinary Swap and the native
 * Pro tab. The "user selected tokens" markers are consumed by the switch,
 * so flipping tabs without a manual selection keeps each mode's state.
 * `accountNetworkId` is the network the Swap context currently sits on
 * (FROM account network); it is passed in so this hook stays free of the
 * account-selector dependency graph.
 */
export function useSwapProTokenCarry({
  accountNetworkId,
}: {
  accountNetworkId?: string;
}) {
  const [fromToken, setSwapSelectFromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapNetworks] = useSwapNetworksAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapToTokenAmount] = useSwapToTokenAmountAtom();
  const [swapUserSelectedTokens, setSwapUserSelectedTokens] =
    useSwapUserSelectedTokensAtom();
  const [swapProUserSelectedToken, setSwapProUserSelectedToken] =
    useSwapProUserSelectedTokenAtom();
  const { setSwapProSelectToken, selectToToken } = useSwapActions().current;
  const swapStableTokenLookupRef = useRef<
    ISwapStableTokenLookupCache | undefined
  >(undefined);
  const swapProStableTokenLookupRef = useRef<
    ISwapStableTokenLookupCache | undefined
  >(undefined);

  // Warm stable-coin classification while the user is still on the source tab.
  // The transition itself reads only a settled matching snapshot and never
  // waits for background I/O.
  useEffect(() => {
    if (!platformEnv.isNative) return;
    if (swapNetworks.length === 0) return;
    if (swapUserSelectedTokens) {
      warmSwapStableTokenKeys([toToken, fromToken], swapStableTokenLookupRef);
    }
    if (swapProUserSelectedToken) {
      warmSwapStableTokenKeys(
        [swapProSelectToken],
        swapProStableTokenLookupRef,
      );
    }
  }, [
    fromToken,
    swapNetworks.length,
    swapProSelectToken,
    swapProUserSelectedToken,
    swapUserSelectedTokens,
    toToken,
  ]);

  const carrySwapTokenToPro = useCallback(() => {
    if (!swapUserSelectedTokens) return;
    // Networks not loaded yet (cold-start race): leave the marker armed so
    // the next switch can still carry instead of silently dropping it.
    if (swapNetworks.length === 0) return;
    // Consume the marker regardless of outcome: a carry that resolves to
    // "bring nothing" must not retrigger on the next tab switch.
    setSwapUserSelectedTokens(false);
    const stableTokenKeys = getSwapStableTokenKeysForCarry({
      tokens: [toToken, fromToken],
      cache: swapStableTokenLookupRef.current,
    });
    // Never guess while the matching lookup is still pending. The marker is
    // already consumed so this abandoned carry cannot replay on a later tab.
    if (!stableTokenKeys) return;
    const token = resolveSwapToProCarryToken({
      toToken,
      fromToken,
      stableTokenKeys,
    });
    if (!token) return;
    if (
      !checkProSupportsNetwork({
        swapNetworks,
        networkId: token.networkId,
      })
    ) {
      return;
    }
    void setSwapProSelectToken(token);
  }, [
    fromToken,
    setSwapProSelectToken,
    setSwapUserSelectedTokens,
    swapNetworks,
    swapUserSelectedTokens,
    toToken,
  ]);

  const prepareProTokenCarryToSwap = useCallback(():
    | {
        targetNetworkId?: string;
        apply: () => Promise<void>;
      }
    | undefined => {
    if (!swapProUserSelectedToken) return undefined;
    if (swapNetworks.length === 0) return undefined;
    setSwapProUserSelectedToken(false);
    const stableTokenKeys = getSwapStableTokenKeysForCarry({
      tokens: [swapProSelectToken],
      cache: swapProStableTokenLookupRef.current,
    });
    if (!stableTokenKeys) return undefined;
    // The Swap context network is the account network; fall back to the
    // FromToken network only when the account network is unknown.
    const swapContextNetworkId = resolveSwapContextNetworkId({
      accountNetworkId,
      fromTokenNetworkId: fromToken?.networkId,
    });
    const token = resolveProToSwapCarryToken({
      proToken: swapProSelectToken,
      swapFromToken: fromToken,
      swapNetworkId: swapContextNetworkId,
      stableTokenKeys,
      swapNetworks,
    });
    if (!token) return undefined;
    const isCrossNetwork = Boolean(
      swapContextNetworkId && token.networkId !== swapContextNetworkId,
    );
    const apply = async () => {
      if (isCrossNetwork && token.networkId) {
        // Cross-network carry: Swap lands on the token's network with the
        // native coin as FromToken (OK-55190 example: BSC -> SOL-JUP).
        const nativeFromToken =
          swapDefaultSetTokens[token.networkId]?.fromToken;
        if (nativeFromToken?.isNative) {
          setSwapSelectFromToken(nativeFromToken);
        }
      }
      // Carried tokens are not a manual Swap pick, so selectToToken opts out
      // of arming the opposite-direction carry marker.
      await selectToToken(token, undefined, undefined, false);
      // The switch action restores the previous pair's amount drafts; the
      // carried pair must not inherit those amounts or quote with them.
      setSwapFromTokenAmount({ value: '', isInput: false });
      setSwapToTokenAmount({ value: '', isInput: false });
    };
    return {
      targetNetworkId: isCrossNetwork ? token.networkId : undefined,
      apply,
    };
  }, [
    accountNetworkId,
    fromToken,
    selectToToken,
    setSwapFromTokenAmount,
    setSwapProUserSelectedToken,
    setSwapSelectFromToken,
    setSwapToTokenAmount,
    swapNetworks,
    swapProSelectToken,
    swapProUserSelectedToken,
  ]);

  return { carrySwapTokenToPro, prepareProTokenCarryToSwap };
}
