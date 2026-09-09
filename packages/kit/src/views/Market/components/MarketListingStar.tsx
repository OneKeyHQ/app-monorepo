import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Stack } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';

import { acquireMarketListingWatchlistIdentity } from '../utils/marketListingWatchlistIdentity';

import { MarketStarV2 } from './MarketStarV2';

import type {
  IMarketListingKind,
  IMarketListingWatchlistIdentity,
} from '../utils/marketListingWatchlistIdentity';

export function MarketListingStar({
  kind,
  listingId,
  from,
  renderButton,
}: {
  kind: IMarketListingKind;
  listingId: string;
  from: EWatchlistFrom;
  renderButton?: (identity: IMarketListingWatchlistIdentity) => ReactNode;
}) {
  const intl = useIntl();
  const isFocused = useRouteIsFocused();
  const releasesRef = useRef(new Set<() => void>());
  useEffect(() => {
    const releases = releasesRef.current;
    return () => {
      releases.forEach((release) => release());
      releases.clear();
    };
  }, [kind, listingId, isFocused]);
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      const request = acquireMarketListingWatchlistIdentity(kind, listingId);
      const releases = releasesRef.current;
      releases.add(request.release);
      try {
        return {
          kind,
          listingId,
          identity: await request.promise,
          failed: false,
        };
      } catch {
        return { kind, listingId, identity: undefined, failed: true };
      } finally {
        request.release();
        releases.delete(request.release);
      }
    },
    [kind, listingId],
    {
      watchLoading: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  // A recycled row must not expose the previous listing's favorite action.
  const current =
    result?.kind === kind && result.listingId === listingId
      ? result
      : undefined;
  const identity = current?.identity;
  const loading = !current || Boolean(isLoading);

  let button: ReactNode;
  if (identity) {
    button = renderButton ? (
      renderButton(identity)
    ) : (
      <MarketStarV2
        {...identity}
        from={from}
        size="small"
        customIconSize="$4"
      />
    );
  } else {
    button = (
      <IconButton
        testID={`market-listing-star-${kind}-${listingId}`}
        icon="StarOutline"
        size="small"
        variant="tertiary"
        loading={loading}
        disabled={loading || !current?.failed}
        title={intl.formatMessage({
          id: current?.failed
            ? ETranslations.global_retry
            : ETranslations.global_not_available,
        })}
        onPress={() => void run()}
      />
    );
  }

  return <Stack onPress={(event) => event.stopPropagation()}>{button}</Stack>;
}
