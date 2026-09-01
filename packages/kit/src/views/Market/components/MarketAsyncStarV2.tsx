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
  from,
  tokenSymbol,
  testID,
  size = 'small',
  iconSize = '$4',
}: {
  identities: IMarketWatchlistIdentity[];
  resolveIdentity: () => Promise<IMarketWatchlistIdentity | undefined>;
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
    if (isResolvingRef.current) {
      return;
    }
    if (checked) {
      setOptimisticChecked(false);
      checkedIdentities.forEach((identity) => {
        actions.removeFromWatchListV2(
          identity.chainId,
          identity.contractAddress,
        );
        logRemoved(identity);
      });
      return;
    }

    isResolvingRef.current = true;
    setOptimisticChecked(true);
    try {
      const identity = await resolveIdentity();
      if (!identity?.chainId) {
        throw new OneKeyLocalError('No watchlist identity');
      }
      setResolvedIdentity(identity);

      if (
        !actions.isInWatchListV2(identity.chainId, identity.contractAddress)
      ) {
        actions.addIntoWatchListV2([identity]);
        logAdded(identity);
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
    intl,
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
      onPress={handlePress}
      size={size}
      variant="tertiary"
    />
  );
}
