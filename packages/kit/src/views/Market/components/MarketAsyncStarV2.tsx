import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IIconButtonProps } from '@onekeyhq/components';
import { IconButton, Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

import { useMarketWatchListV2Atom } from '../../../states/jotai/contexts/marketV2';

import { useWatchListV2Action } from './watchListHooksV2';

export type IMarketWatchlistIdentity = {
  chainId: string;
  contractAddress: string;
  isNative?: boolean;
};

export type IMarketIdentityResolveOptions = {
  intent?: 'interaction' | 'prefetch';
  isCanceled?: () => boolean;
};

type IMarketIdentityRequestJob = {
  interactive: boolean;
  run: () => void;
  shouldSkip: () => boolean;
  skip: () => void;
};

const MARKET_IDENTITY_REQUEST_CONCURRENCY = 3;
const marketIdentityRequestQueue: IMarketIdentityRequestJob[] = [];
let activeMarketIdentityRequests = 0;

function drainMarketIdentityRequestQueue() {
  while (activeMarketIdentityRequests < MARKET_IDENTITY_REQUEST_CONCURRENCY) {
    const job = marketIdentityRequestQueue.shift();
    if (!job) {
      return;
    }
    if (!job.interactive && job.shouldSkip()) {
      job.skip();
    } else {
      activeMarketIdentityRequests += 1;
      job.run();
    }
  }
}

function scheduleMarketIdentityRequest<T>(
  load: () => Promise<T | undefined>,
  intent: 'interaction' | 'prefetch',
  shouldSkip: () => boolean,
) {
  let resolveRequest: (result: {
    skipped: boolean;
    value: T | undefined;
  }) => void = () => undefined;
  let rejectRequest: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<{
    skipped: boolean;
    value: T | undefined;
  }>((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  const job: IMarketIdentityRequestJob = {
    interactive: intent === 'interaction',
    shouldSkip,
    skip: () => resolveRequest({ skipped: true, value: undefined }),
    run: () => {
      void load()
        .then((value) => resolveRequest({ skipped: false, value }))
        .catch(rejectRequest)
        .finally(() => {
          activeMarketIdentityRequests -= 1;
          drainMarketIdentityRequestQueue();
        });
    },
  };
  if (job.interactive) {
    marketIdentityRequestQueue.unshift(job);
  } else {
    marketIdentityRequestQueue.push(job);
  }
  drainMarketIdentityRequestQueue();

  return {
    promise,
    promote: () => {
      job.interactive = true;
      const queueIndex = marketIdentityRequestQueue.indexOf(job);
      if (queueIndex > 0) {
        marketIdentityRequestQueue.splice(queueIndex, 1);
        marketIdentityRequestQueue.unshift(job);
      }
    },
  };
}

export function createCachedMarketIdentityResolver<TKey, TValue>({
  failureCacheTtlMs,
  load,
}: {
  failureCacheTtlMs: number;
  load: (key: TKey) => Promise<TValue | undefined>;
}) {
  const identityCache = new Map<TKey, TValue>();
  const failureCache = new Map<TKey, number>();
  const pendingRequests = new Map<
    TKey,
    {
      prefetchConsumers: Array<() => boolean>;
      promise: Promise<TValue | undefined>;
      promote: () => void;
    }
  >();

  return (
    key: TKey,
    options: IMarketIdentityResolveOptions = {},
  ): Promise<TValue | undefined> => {
    const intent = options.intent ?? 'interaction';
    if (intent === 'prefetch') {
      if (identityCache.has(key)) {
        return Promise.resolve(identityCache.get(key));
      }
      const failureExpiresAt = failureCache.get(key);
      if (failureExpiresAt && failureExpiresAt > Date.now()) {
        return Promise.resolve(undefined);
      }
      failureCache.delete(key);
    }

    const pendingRequest = pendingRequests.get(key);
    if (pendingRequest) {
      if (intent === 'interaction') {
        pendingRequest.promote();
      } else if (options.isCanceled) {
        pendingRequest.prefetchConsumers.push(options.isCanceled);
      }
      return pendingRequest.promise;
    }

    const prefetchConsumers = options.isCanceled ? [options.isCanceled] : [];
    const scheduledRequest = scheduleMarketIdentityRequest(
      () => load(key),
      intent,
      () =>
        prefetchConsumers.length > 0 &&
        prefetchConsumers.every((isCanceled) => isCanceled()),
    );
    const promise = scheduledRequest.promise
      .then(({ skipped, value }) => {
        if (skipped) {
          return undefined;
        }
        if (value === undefined) {
          failureCache.set(key, Date.now() + failureCacheTtlMs);
        } else {
          failureCache.delete(key);
          identityCache.set(key, value);
        }
        return value;
      })
      .catch((error: unknown) => {
        failureCache.set(key, Date.now() + failureCacheTtlMs);
        throw error;
      })
      .finally(() => {
        if (pendingRequests.get(key)?.promise === promise) {
          pendingRequests.delete(key);
        }
      });
    pendingRequests.set(key, {
      prefetchConsumers,
      promise,
      promote: scheduledRequest.promote,
    });
    return promise;
  };
}

function isSameIdentity(
  left: IMarketWatchlistIdentity,
  right: IMarketWatchlistIdentity,
) {
  return equalTokenNoCaseSensitive({
    token1: {
      networkId: left.chainId,
      contractAddress: left.contractAddress,
    },
    token2: {
      networkId: right.chainId,
      contractAddress: right.contractAddress,
    },
  });
}

export function MarketAsyncStarV2({
  identities,
  resolveIdentity,
  identityKey,
  resolveOnMount = false,
  from,
  tokenSymbol,
  testID,
  size = 'small',
  iconSize = '$4',
}: {
  identities: IMarketWatchlistIdentity[];
  resolveIdentity: (
    options?: IMarketIdentityResolveOptions,
  ) => Promise<IMarketWatchlistIdentity | undefined>;
  identityKey: string;
  resolveOnMount?: boolean;
  from: EWatchlistFrom;
  tokenSymbol?: string;
  testID: string;
  size?: IIconButtonProps['size'];
  iconSize?: IIconButtonProps['iconSize'];
}) {
  const intl = useIntl();
  const actions = useWatchListV2Action();
  const [{ data: watchListData, isMounted }] = useMarketWatchListV2Atom();
  const [resolvedIdentity, setResolvedIdentity] =
    useState<IMarketWatchlistIdentity>();
  const [optimisticChecked, setOptimisticChecked] = useState<boolean>();
  const isResolvingRef = useRef(false);
  const identityKeyRef = useRef(identityKey);

  useEffect(() => {
    identityKeyRef.current = identityKey;
    isResolvingRef.current = false;
    setResolvedIdentity(undefined);
    setOptimisticChecked(undefined);
  }, [identityKey]);

  useEffect(() => {
    if (!resolveOnMount || !isMounted || watchListData.length === 0) {
      return;
    }
    let canceled = false;
    const requestIdentityKey = identityKey;
    void resolveIdentity({
      intent: 'prefetch',
      isCanceled: () => canceled,
    })
      .then((identity) => {
        if (
          !canceled &&
          identity &&
          identityKeyRef.current === requestIdentityKey
        ) {
          setResolvedIdentity(identity);
        }
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, [
    identityKey,
    isMounted,
    resolveIdentity,
    resolveOnMount,
    watchListData.length,
  ]);

  const candidateIdentities = useMemo(() => {
    if (
      !resolvedIdentity ||
      identities.some((identity) => isSameIdentity(identity, resolvedIdentity))
    ) {
      return identities;
    }
    return [...identities, resolvedIdentity];
  }, [identities, resolvedIdentity]);

  const checkedIdentities = useMemo(() => {
    if (!isMounted || watchListData.length === 0) {
      return [];
    }
    return candidateIdentities.filter((identity) =>
      watchListData.some((item) =>
        isSameIdentity(identity, {
          chainId: item.chainId,
          contractAddress: item.contractAddress,
        }),
      ),
    );
  }, [candidateIdentities, isMounted, watchListData]);
  const checked = checkedIdentities.length > 0;
  const displayedChecked = optimisticChecked ?? checked;

  useEffect(() => {
    if (optimisticChecked !== undefined && optimisticChecked === checked) {
      setOptimisticChecked(undefined);
    }
  }, [checked, optimisticChecked]);

  const logAdded = useCallback(
    (identity: IMarketWatchlistIdentity) => {
      defaultLogger.dex.watchlist.dexAddToWatchlist({
        network: identity.chainId,
        tokenSymbol: tokenSymbol || '',
        tokenContract: identity.contractAddress,
        addFrom: from,
      });
    },
    [from, tokenSymbol],
  );
  const logRemoved = useCallback(
    (identity: IMarketWatchlistIdentity) => {
      defaultLogger.dex.watchlist.dexRemoveFromWatchlist({
        network: identity.chainId,
        tokenSymbol: tokenSymbol || '',
        tokenContract: identity.contractAddress,
        removeFrom: from,
      });
    },
    [from, tokenSymbol],
  );

  const handlePress = useCallback(async () => {
    if (!isMounted || isResolvingRef.current) {
      return;
    }
    const requestIdentityKey = identityKey;
    isResolvingRef.current = true;
    if (checked) {
      setOptimisticChecked(false);
      try {
        const results = await Promise.all(
          checkedIdentities.map(async (identity) => {
            const removed = await actions.removeFromWatchListV2(
              identity.chainId,
              identity.contractAddress,
            );
            if (removed) {
              logRemoved(identity);
            }
            return removed;
          }),
        );
        if (
          results.some((removed) => !removed) &&
          identityKeyRef.current === requestIdentityKey
        ) {
          setOptimisticChecked(undefined);
        }
      } finally {
        isResolvingRef.current = false;
      }
      return;
    }

    setOptimisticChecked(true);
    try {
      const identity = await resolveIdentity({ intent: 'interaction' });
      if (!identity?.chainId) {
        throw new OneKeyLocalError('No watchlist identity');
      }
      if (identityKeyRef.current !== requestIdentityKey) {
        return;
      }
      setResolvedIdentity(identity);

      if (actions.isInWatchListV2(identity.chainId, identity.contractAddress)) {
        setOptimisticChecked(undefined);
        return;
      }

      const added = await actions.addIntoWatchListV2([identity]);
      if (added) {
        logAdded(identity);
      } else {
        setOptimisticChecked(undefined);
      }
    } catch (_error) {
      setOptimisticChecked(undefined);
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_an_error_occurred,
        }),
      });
    } finally {
      isResolvingRef.current = false;
    }
  }, [
    actions,
    checked,
    checkedIdentities,
    identityKey,
    intl,
    isMounted,
    logAdded,
    logRemoved,
    resolveIdentity,
  ]);

  return (
    <IconButton
      testID={testID}
      title={intl.formatMessage({
        id: displayedChecked
          ? ETranslations.market_remove_from_favorites
          : ETranslations.market_add_to_favorites,
      })}
      icon={displayedChecked ? 'StarSolid' : 'StarOutline'}
      iconSize={iconSize}
      iconProps={{
        color: displayedChecked ? '$iconActive' : '$iconSubdued',
      }}
      disabled={!isMounted}
      onPress={handlePress}
      size={size}
      variant="tertiary"
    />
  );
}
