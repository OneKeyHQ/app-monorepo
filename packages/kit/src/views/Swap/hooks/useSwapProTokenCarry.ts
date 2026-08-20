import { useCallback, useEffect, useRef } from 'react';

import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapNetworksAtom,
  useSwapProSelectTokenAtom,
  useSwapProUserSelectedTokenAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
  useSwapUserSelectedTokensAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

type ISwapCarryTokenCandidate = Pick<
  ISwapToken,
  'networkId' | 'contractAddress' | 'isStock'
>;

export type ISwapStableTokenStatusCacheEntry = {
  isStableCoin?: boolean;
  promise?: Promise<boolean>;
};

type ISwapStableTokenStatusCache = Map<
  string,
  ISwapStableTokenStatusCacheEntry
>;

export type ISwapProToSwapCarryPlan = {
  targetNetworkId?: string;
  isValid: () => boolean;
  apply: () => Promise<void>;
};

export type IPreparedSwapProToSwapCarry = {
  immediate?: ISwapProToSwapCarryPlan;
  pending?: Promise<ISwapProToSwapCarryPlan | undefined>;
};

const EMPTY_STABLE_TOKEN_KEYS = new Set<string>();

// Bounds background classification. Tab transitions never wait for this
// request; pending work is guarded by the target tab and target-side manual
// selection before it can apply. A settled failure keeps OK-55190's
// treat-as-non-stable fallback.
const SWAP_STABLE_CHECK_TIMEOUT_MS = 2000;

// Stable status is cached by token identity rather than by pair identity.
// This mirrors the server contract and lets common tokens reuse a settled
// classification across different Swap pairs and both carry directions.
const swapStableTokenStatusCache: ISwapStableTokenStatusCache = new Map();

function buildStableTokenKey({
  networkId,
  contractAddress,
}: Pick<ISwapToken, 'networkId' | 'contractAddress'>) {
  return `${networkId}:${(contractAddress ?? '').toLowerCase()}`;
}

export function getSwapStableTokenKeysForCarry({
  tokens,
  cache,
}: {
  tokens: Array<ISwapCarryTokenCandidate | undefined>;
  cache: ReadonlyMap<string, ISwapStableTokenStatusCacheEntry>;
}) {
  const stableTokenKeys = new Set<string>();
  const tokenKeys = tokens
    .filter(
      (token): token is ISwapCarryTokenCandidate =>
        Boolean(token?.networkId && token.contractAddress) && !token?.isStock,
    )
    .map(buildStableTokenKey);
  for (const key of new Set(tokenKeys)) {
    const status = cache.get(key)?.isStableCoin;
    if (status === undefined) return undefined;
    if (status) stableTokenKeys.add(key);
  }
  return stableTokenKeys;
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

export function resolveSwapProCarryIntentStatus({
  currentType,
  sourceType,
  targetType,
  enteredTarget,
  targetUserSelected,
}: {
  currentType: ESwapTabSwitchType;
  sourceType: ESwapTabSwitchType;
  targetType: ESwapTabSwitchType;
  enteredTarget: boolean;
  targetUserSelected: boolean;
}): 'waiting' | 'ready' | 'cancel' {
  if (targetUserSelected) return 'cancel';
  if (currentType === targetType) return 'ready';
  if (enteredTarget || currentType !== sourceType) return 'cancel';
  return 'waiting';
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

export function warmSwapStableTokenKeys(
  tokens: Array<ISwapCarryTokenCandidate | undefined>,
  cache: ISwapStableTokenStatusCache,
): Promise<Set<string>> {
  const candidates = Array.from(
    new Map(
      tokens
        .filter(
          (token): token is ISwapCarryTokenCandidate =>
            Boolean(token?.networkId && token.contractAddress) &&
            !token?.isStock,
        )
        .map((token) => [buildStableTokenKey(token), token]),
    ).entries(),
  );
  const pending = candidates.map(([key, token]) => {
    const cached = cache.get(key);
    if (cached?.isStableCoin !== undefined) {
      return Promise.resolve(cached.isStableCoin);
    }
    if (cached?.promise) return cached.promise;
    // Deliberately use one token per request so the background 12-hour memo
    // is reusable across pair combinations instead of being pair-keyed.
    const promise = fetchSwapStableTokenKeys([token]).then(
      (stableTokenKeys) => {
        const isStableCoin = stableTokenKeys.has(key);
        cache.set(key, { isStableCoin });
        return isStableCoin;
      },
      () => {
        cache.set(key, { isStableCoin: false });
        return false;
      },
    );
    cache.set(key, { promise });
    return promise;
  });
  if (pending.length === 0) {
    return Promise.resolve(EMPTY_STABLE_TOKEN_KEYS);
  }
  return Promise.all(pending).then(
    () =>
      getSwapStableTokenKeysForCarry({ tokens, cache }) ??
      EMPTY_STABLE_TOKEN_KEYS,
  );
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
  isAllNetworkSelected = false,
}: {
  accountNetworkId?: string;
  isAllNetworkSelected?: boolean;
}) {
  const [fromToken, setSwapSelectFromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapNetworks] = useSwapNetworksAtom();
  const [swapProSelectToken] = useSwapProSelectTokenAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapToTokenAmount] = useSwapToTokenAmountAtom();
  const [swapUserSelectedTokens, setSwapUserSelectedTokens] =
    useSwapUserSelectedTokensAtom();
  const [swapProUserSelectedToken, setSwapProUserSelectedToken] =
    useSwapProUserSelectedTokenAtom();
  const { setSwapProSelectToken, selectToToken } = useSwapActions().current;
  const swapNetworksRef = useRef(swapNetworks);
  const swapTypeSwitchRef = useRef(swapTypeSwitch);
  const swapUserSelectedTokensRef = useRef(swapUserSelectedTokens);
  const swapProUserSelectedTokenRef = useRef(swapProUserSelectedToken);
  const accountNetworkIdRef = useRef(accountNetworkId);
  const isAllNetworkSelectedRef = useRef(isAllNetworkSelected);
  swapNetworksRef.current = swapNetworks;
  swapTypeSwitchRef.current = swapTypeSwitch;
  swapUserSelectedTokensRef.current = swapUserSelectedTokens;
  swapProUserSelectedTokenRef.current = swapProUserSelectedToken;
  accountNetworkIdRef.current = accountNetworkId;
  isAllNetworkSelectedRef.current = isAllNetworkSelected;

  const swapToProCarryGenerationRef = useRef(0);
  const proToSwapCarryGenerationRef = useRef(0);
  const pendingSwapToProCarryRef = useRef<
    | {
        id: number;
        sourceType: ESwapTabSwitchType;
        enteredTarget: boolean;
        fromToken?: ISwapToken;
        toToken?: ISwapToken;
      }
    | undefined
  >(undefined);
  const pendingProToSwapCarryRef = useRef<
    | {
        id: number;
        enteredTarget: boolean;
        proToken?: ISwapToken;
        swapFromToken?: ISwapToken;
        accountNetworkId?: string;
        isAllNetworkSelected: boolean;
        resolve: (plan: ISwapProToSwapCarryPlan | undefined) => void;
      }
    | undefined
  >(undefined);

  // Warm the current tokens even before a carry marker is armed. Classification
  // is cached per token, so common stable coins can be reused across pairs.
  useEffect(() => {
    if (!platformEnv.isNative) return;
    void warmSwapStableTokenKeys(
      [toToken, fromToken, swapProSelectToken],
      swapStableTokenStatusCache,
    );
  }, [fromToken, swapProSelectToken, toToken]);

  const cancelPendingSwapToProCarry = useCallback(() => {
    if (!pendingSwapToProCarryRef.current) return;
    pendingSwapToProCarryRef.current = undefined;
    swapToProCarryGenerationRef.current += 1;
  }, []);

  const cancelPendingProToSwapCarry = useCallback(() => {
    const pending = pendingProToSwapCarryRef.current;
    if (!pending) return;
    pendingProToSwapCarryRef.current = undefined;
    proToSwapCarryGenerationRef.current += 1;
    pending.resolve(undefined);
  }, []);

  const tryApplyPendingSwapToProCarry = useCallback(() => {
    const pending = pendingSwapToProCarryRef.current;
    if (!pending) return;
    const status = resolveSwapProCarryIntentStatus({
      currentType: swapTypeSwitchRef.current,
      sourceType: pending.sourceType,
      targetType: ESwapTabSwitchType.LIMIT,
      enteredTarget: pending.enteredTarget,
      targetUserSelected: swapProUserSelectedTokenRef.current,
    });
    if (status === 'ready') {
      pending.enteredTarget = true;
    } else if (status === 'cancel') {
      cancelPendingSwapToProCarry();
      return;
    }
    if (!pending.enteredTarget) return;
    const currentNetworks = swapNetworksRef.current;
    if (currentNetworks.length === 0) return;
    const stableTokenKeys = getSwapStableTokenKeysForCarry({
      tokens: [pending.toToken, pending.fromToken],
      cache: swapStableTokenStatusCache,
    });
    if (!stableTokenKeys) return;
    pendingSwapToProCarryRef.current = undefined;
    const token = resolveSwapToProCarryToken({
      toToken: pending.toToken,
      fromToken: pending.fromToken,
      stableTokenKeys,
    });
    if (
      token &&
      checkProSupportsNetwork({
        swapNetworks: currentNetworks,
        networkId: token.networkId,
      }) &&
      pending.id === swapToProCarryGenerationRef.current
    ) {
      void setSwapProSelectToken(token);
    }
  }, [cancelPendingSwapToProCarry, setSwapProSelectToken]);

  const buildProToSwapCarryPlan = useCallback(
    ({
      id,
      proToken,
      swapFromToken,
      sourceAccountNetworkId,
      sourceIsAllNetworkSelected,
      stableTokenKeys,
      currentNetworks,
    }: {
      id: number;
      proToken?: ISwapToken;
      swapFromToken?: ISwapToken;
      sourceAccountNetworkId?: string;
      sourceIsAllNetworkSelected: boolean;
      stableTokenKeys: Set<string>;
      currentNetworks: ISwapNetwork[];
    }): ISwapProToSwapCarryPlan | undefined => {
      const swapContextNetworkId = resolveSwapContextNetworkId({
        accountNetworkId: sourceAccountNetworkId,
        fromTokenNetworkId: swapFromToken?.networkId,
        isAllNetwork: sourceIsAllNetworkSelected,
      });
      const token = resolveProToSwapCarryToken({
        proToken,
        swapFromToken,
        swapNetworkId: swapContextNetworkId,
        stableTokenKeys,
        swapNetworks: currentNetworks,
      });
      if (!token) return undefined;
      const isCrossNetwork = Boolean(
        swapContextNetworkId && token.networkId !== swapContextNetworkId,
      );
      const allowedAccountNetworkIds = new Set(
        [
          sourceAccountNetworkId,
          swapFromToken?.networkId,
          isCrossNetwork ? token.networkId : undefined,
        ].filter((networkId): networkId is string => Boolean(networkId)),
      );
      const isValid = () => {
        const currentAccountNetworkId = accountNetworkIdRef.current;
        const hasCompatibleAccountContext = sourceIsAllNetworkSelected
          ? isAllNetworkSelectedRef.current
          : !isAllNetworkSelectedRef.current &&
            (!currentAccountNetworkId ||
              allowedAccountNetworkIds.has(currentAccountNetworkId));
        return (
          id === proToSwapCarryGenerationRef.current &&
          swapTypeSwitchRef.current === ESwapTabSwitchType.SWAP &&
          !swapUserSelectedTokensRef.current &&
          hasCompatibleAccountContext
        );
      };
      const apply = async () => {
        if (!isValid()) return;
        if (isCrossNetwork && token.networkId) {
          // Cross-network carry: Swap lands on the token's network with the
          // native coin as FromToken (OK-55190 example: BSC -> SOL-JUP).
          const nativeFromToken =
            swapDefaultSetTokens[token.networkId]?.fromToken;
          if (nativeFromToken?.isNative) {
            setSwapSelectFromToken(nativeFromToken);
          }
        }
        if (!isValid()) return;
        // Carried tokens are not a manual Swap pick, so selectToToken opts out
        // of arming the opposite-direction carry marker.
        await selectToToken(token, undefined, undefined, false);
        if (!isValid()) return;
        // The switch action restores the previous pair's amount drafts; the
        // carried pair must not inherit those amounts or quote with them.
        setSwapFromTokenAmount({ value: '', isInput: false });
        setSwapToTokenAmount({ value: '', isInput: false });
      };
      return {
        targetNetworkId: isCrossNetwork ? token.networkId : undefined,
        isValid,
        apply,
      };
    },
    [
      selectToToken,
      setSwapFromTokenAmount,
      setSwapSelectFromToken,
      setSwapToTokenAmount,
    ],
  );

  const tryResolvePendingProToSwapCarry = useCallback(() => {
    const pending = pendingProToSwapCarryRef.current;
    if (!pending) return;
    const status = resolveSwapProCarryIntentStatus({
      currentType: swapTypeSwitchRef.current,
      sourceType: ESwapTabSwitchType.LIMIT,
      targetType: ESwapTabSwitchType.SWAP,
      enteredTarget: pending.enteredTarget,
      targetUserSelected: swapUserSelectedTokensRef.current,
    });
    if (status === 'ready') {
      pending.enteredTarget = true;
    } else if (status === 'cancel') {
      cancelPendingProToSwapCarry();
      return;
    }
    if (!pending.enteredTarget) return;
    const currentNetworks = swapNetworksRef.current;
    if (currentNetworks.length === 0) return;
    const stableTokenKeys = getSwapStableTokenKeysForCarry({
      tokens: [pending.proToken],
      cache: swapStableTokenStatusCache,
    });
    if (!stableTokenKeys) return;
    pendingProToSwapCarryRef.current = undefined;
    pending.resolve(
      buildProToSwapCarryPlan({
        id: pending.id,
        proToken: pending.proToken,
        swapFromToken: pending.swapFromToken,
        sourceAccountNetworkId: pending.accountNetworkId,
        sourceIsAllNetworkSelected: pending.isAllNetworkSelected,
        stableTokenKeys,
        currentNetworks,
      }),
    );
  }, [buildProToSwapCarryPlan, cancelPendingProToSwapCarry]);

  useEffect(() => {
    tryApplyPendingSwapToProCarry();
    tryResolvePendingProToSwapCarry();
  }, [
    swapNetworks,
    swapProUserSelectedToken,
    swapTypeSwitch,
    swapUserSelectedTokens,
    tryApplyPendingSwapToProCarry,
    tryResolvePendingProToSwapCarry,
  ]);

  useEffect(
    () => () => {
      cancelPendingSwapToProCarry();
      cancelPendingProToSwapCarry();
    },
    [cancelPendingProToSwapCarry, cancelPendingSwapToProCarry],
  );

  const carrySwapTokenToPro = useCallback(() => {
    if (!swapUserSelectedTokens) return;
    // Transfer the one-shot marker into a guarded intent before the shared tab
    // action invalidates it. Pending network/classification work may finish
    // later, but only while the user remains on Pro without a manual Pro pick.
    setSwapUserSelectedTokens(false);
    swapUserSelectedTokensRef.current = false;
    cancelPendingSwapToProCarry();
    const id = swapToProCarryGenerationRef.current + 1;
    swapToProCarryGenerationRef.current = id;
    const sourceType = swapTypeSwitchRef.current;
    const capturedTokens = [toToken, fromToken];
    const lookupPromise = warmSwapStableTokenKeys(
      capturedTokens,
      swapStableTokenStatusCache,
    );
    const stableTokenKeys = getSwapStableTokenKeysForCarry({
      tokens: capturedTokens,
      cache: swapStableTokenStatusCache,
    });
    if (stableTokenKeys && swapNetworks.length > 0) {
      const token = resolveSwapToProCarryToken({
        toToken,
        fromToken,
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
      return;
    }
    pendingSwapToProCarryRef.current = {
      id,
      sourceType,
      enteredTarget: false,
      fromToken,
      toToken,
    };
    void lookupPromise.then(tryApplyPendingSwapToProCarry);
  }, [
    cancelPendingSwapToProCarry,
    fromToken,
    setSwapProSelectToken,
    setSwapUserSelectedTokens,
    swapNetworks,
    swapUserSelectedTokens,
    toToken,
    tryApplyPendingSwapToProCarry,
  ]);

  const prepareProTokenCarryToSwap = useCallback(():
    | IPreparedSwapProToSwapCarry
    | undefined => {
    if (!swapProUserSelectedToken) return undefined;
    setSwapProUserSelectedToken(false);
    swapProUserSelectedTokenRef.current = false;
    cancelPendingProToSwapCarry();
    const id = proToSwapCarryGenerationRef.current + 1;
    proToSwapCarryGenerationRef.current = id;
    const lookupPromise = warmSwapStableTokenKeys(
      [swapProSelectToken],
      swapStableTokenStatusCache,
    );
    const stableTokenKeys = getSwapStableTokenKeysForCarry({
      tokens: [swapProSelectToken],
      cache: swapStableTokenStatusCache,
    });
    if (stableTokenKeys && swapNetworks.length > 0) {
      return {
        immediate: buildProToSwapCarryPlan({
          id,
          proToken: swapProSelectToken,
          swapFromToken: fromToken,
          sourceAccountNetworkId: accountNetworkId,
          sourceIsAllNetworkSelected: isAllNetworkSelected,
          stableTokenKeys,
          currentNetworks: swapNetworks,
        }),
      };
    }
    let resolvePending: (
      plan: ISwapProToSwapCarryPlan | undefined,
    ) => void = () => undefined;
    const pending = new Promise<ISwapProToSwapCarryPlan | undefined>(
      (resolve) => {
        resolvePending = resolve;
      },
    );
    pendingProToSwapCarryRef.current = {
      id,
      enteredTarget: false,
      proToken: swapProSelectToken,
      swapFromToken: fromToken,
      accountNetworkId,
      isAllNetworkSelected,
      resolve: resolvePending,
    };
    void lookupPromise.then(tryResolvePendingProToSwapCarry);
    return { pending };
  }, [
    accountNetworkId,
    buildProToSwapCarryPlan,
    cancelPendingProToSwapCarry,
    fromToken,
    isAllNetworkSelected,
    setSwapProUserSelectedToken,
    swapNetworks,
    swapProSelectToken,
    swapProUserSelectedToken,
    tryResolvePendingProToSwapCarry,
  ]);

  return { carrySwapTokenToPro, prepareProTokenCarryToSwap };
}
