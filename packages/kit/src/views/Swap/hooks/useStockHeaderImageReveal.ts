import { useCallback, useEffect, useRef, useState } from 'react';

export const STOCK_HEADER_IMAGE_REVEAL_TIMEOUT_MS = 1000;

type IStockHeaderImageRevealState = {
  identityKey: string;
  tokenImageDisplayed: boolean;
  networkImageDisplayed: boolean;
  degraded: boolean;
};

function createRevealState({
  identityKey,
  requiresNetworkImage,
  requiresTokenImage,
}: {
  identityKey: string;
  requiresNetworkImage: boolean;
  requiresTokenImage: boolean;
}): IStockHeaderImageRevealState {
  return {
    identityKey,
    tokenImageDisplayed: !requiresTokenImage,
    networkImageDisplayed: !requiresNetworkImage,
    degraded: false,
  };
}

export function buildStockHeaderImageIdentityKey({
  networkId,
  networkImageUri,
  tokenIdentityKey,
  tokenImageUris,
}: {
  networkId?: string;
  networkImageUri?: string;
  tokenIdentityKey: string;
  tokenImageUris: string[];
}) {
  if (!tokenIdentityKey) {
    return '';
  }
  return JSON.stringify([
    tokenIdentityKey,
    [...new Set(tokenImageUris)],
    networkId ?? '',
    networkImageUri ?? '',
  ]);
}

export function useStockHeaderImageReveal({
  enabled,
  networkId,
  networkImageUri,
  timeoutMs = STOCK_HEADER_IMAGE_REVEAL_TIMEOUT_MS,
  tokenIdentityKey,
  tokenImageUris,
}: {
  enabled: boolean;
  networkId?: string;
  networkImageUri?: string;
  timeoutMs?: number;
  tokenIdentityKey: string;
  tokenImageUris: string[];
}) {
  const identityKey = buildStockHeaderImageIdentityKey({
    networkId,
    networkImageUri,
    tokenIdentityKey,
    tokenImageUris,
  });
  const requiresTokenImage = tokenImageUris.length > 0;
  // A known network must own a visible badge. If its URI is still resolving,
  // keep the existing header skeleton instead of briefly revealing no badge.
  const requiresNetworkImage = Boolean(networkId);
  const currentScopeRef = useRef(identityKey);
  currentScopeRef.current = identityKey;
  const [state, setState] = useState(() =>
    createRevealState({
      identityKey,
      requiresNetworkImage,
      requiresTokenImage,
    }),
  );

  useEffect(() => {
    setState((current) =>
      current.identityKey === identityKey
        ? current
        : createRevealState({
            identityKey,
            requiresNetworkImage,
            requiresTokenImage,
          }),
    );
    if (!enabled || !identityKey) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      setState((current) =>
        current.identityKey === identityKey &&
        !(current.tokenImageDisplayed && current.networkImageDisplayed)
          ? { ...current, degraded: true }
          : current,
      );
    }, timeoutMs);
    return () => clearTimeout(timeout);
  }, [
    enabled,
    identityKey,
    requiresNetworkImage,
    requiresTokenImage,
    timeoutMs,
  ]);

  const markImageDisplayed = useCallback(
    (image: 'network' | 'token') => {
      if (currentScopeRef.current !== identityKey) {
        return;
      }
      setState((current) => {
        const scopedState =
          current.identityKey === identityKey
            ? current
            : createRevealState({
                identityKey,
                requiresNetworkImage,
                requiresTokenImage,
              });
        if (scopedState.degraded) {
          // Keep the timeout fallback stable; a late image must not reintroduce
          // the exact placeholder-to-logo transition this gate prevents.
          return scopedState;
        }
        return image === 'token'
          ? { ...scopedState, tokenImageDisplayed: true }
          : { ...scopedState, networkImageDisplayed: true };
      });
    },
    [identityKey, requiresNetworkImage, requiresTokenImage],
  );

  const isCurrentIdentity = state.identityKey === identityKey;
  const reveal =
    !enabled ||
    !identityKey ||
    (isCurrentIdentity &&
      (state.degraded ||
        (state.tokenImageDisplayed && state.networkImageDisplayed)));

  return {
    degraded: isCurrentIdentity && state.degraded,
    identityKey,
    reveal,
    onNetworkImageDisplay: useCallback(
      () => markImageDisplayed('network'),
      [markImageDisplayed],
    ),
    onTokenImageDisplay: useCallback(
      () => markImageDisplayed('token'),
      [markImageDisplayed],
    ),
  };
}
