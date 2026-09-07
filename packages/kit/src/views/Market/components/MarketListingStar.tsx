import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Stack } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';

import { resolveMarketListingWatchlistIdentity } from '../utils/marketListingWatchlistIdentity';

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
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      try {
        return {
          kind,
          listingId,
          identity: await resolveMarketListingWatchlistIdentity(
            kind,
            listingId,
          ),
          failed: false,
        };
      } catch {
        return { kind, listingId, identity: undefined, failed: true };
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
