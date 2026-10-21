import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Badge, SizableText, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import {
  ProtocolImage,
  formatTvl,
} from '../../../Staking/components/ProtocolDisplayShared';
import {
  collectLendingOffers,
  collectNetworkOffers,
} from '../../components/desktopHome/earnDesktopHome.utils';
import { useEarnDesktopMarkets } from '../../components/desktopHome/useEarnDesktopHomeData';
import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';
import { getProtocolAprText } from '../../components/showProtocolListDialog';
import { getProtocolAprColor } from '../../components/showProtocolListDialog.utils';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

const EMPTY_OFFERS: IEarnDesktopHoldOffer[] = [];

// What the token earns on this network: the protocol list and the lending
// markets' supply, the best rate first, as the home's row counted them
export function useEarnRouterOffers({
  symbol,
  networkId,
  enabled = true,
}: {
  symbol: string;
  networkId: string;
  enabled?: boolean;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const accountId = activeAccount.account?.id;
  const accountNetworkId = activeAccount.network?.id;
  const { result: protocols } = usePromiseResult(
    async () =>
      enabled
        ? backgroundApiProxy.serviceStaking
            .getProtocolList({ symbol, accountId, networkId: accountNetworkId })
            .catch(() => [] as IStakeProtocolListItem[])
        : [],
    [accountId, accountNetworkId, enabled, symbol],
  );
  const { markets, isLoaded: isMarketsLoaded } = useEarnDesktopMarkets({
    isActive: enabled,
  });
  const offers = useMemo(() => {
    if (!protocols) {
      return EMPTY_OFFERS;
    }
    return collectNetworkOffers({
      networkId,
      protocols,
      lendingOffers:
        collectLendingOffers({ markets }).get(symbol.toLowerCase()) ?? [],
    });
  }, [markets, networkId, protocols, symbol]);
  return { offers, isLoaded: Boolean(protocols) && isMarketsLoaded };
}

export const getOfferName = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.marketLabel
    : getEarnProviderDisplayName(offer.item.provider.name);

export const getOfferLogo = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.market.logoURI
    : offer.item.provider.logoURI;

// A vault names itself; a fixed rate says when it matures
export const getOfferSubtitle = (offer: IEarnDesktopHoldOffer) => {
  if (offer.kind === 'lending') {
    return undefined;
  }
  return offer.isFixedRate
    ? offer.item.provider.maturity
    : offer.item.provider.vaultName;
};

export const getOfferTvl = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.tvlText
    : formatTvl(offer.item.provider.tvl);

export function OfferRate({ offer }: { offer: IEarnDesktopHoldOffer }) {
  if (offer.kind === 'lending') {
    return (
      <EarnAprSuffixText
        text={`${new BigNumber(offer.offer.apy).toFixed(2)}%`}
      />
    );
  }
  return (
    <EarnAprSuffixText
      text={getProtocolAprText(offer.item)}
      color={getProtocolAprColor(offer.item.aprInfo)}
    />
  );
}

// The protocol switcher's item, so the list reads like the one the deposit
// modal opens
export function OfferSummary({
  offer,
  networkLogoURI,
}: {
  offer: IEarnDesktopHoldOffer;
  networkLogoURI?: string;
}) {
  const intl = useIntl();
  const subtitle = getOfferSubtitle(offer);
  const tvl = getOfferTvl(offer);
  return (
    <>
      <ProtocolImage
        logoURI={getOfferLogo(offer)}
        networkLogoURI={networkLogoURI}
      />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <XStack ai="center" gap="$1.5" minWidth={0}>
          <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
            {getOfferName(offer)}
          </SizableText>
          {offer.isFixedRate ? (
            <Badge badgeType="default" badgeSize="sm">
              <Badge.Text>
                {intl.formatMessage({ id: ETranslations.defi_fixed_rate })}
              </Badge.Text>
            </Badge>
          ) : null}
          {offer.kind === 'protocol'
            ? offer.item.provider.badges?.map((badge) => (
                <Badge
                  key={badge.tag}
                  badgeType={badge.badgeType}
                  badgeSize="sm"
                >
                  <Badge.Text>{badge.tag}</Badge.Text>
                </Badge>
              ))
            : null}
        </XStack>
        {subtitle ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
      <YStack ai="flex-end" gap="$0.5" flexShrink={0}>
        <OfferRate offer={offer} />
        {tvl ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {`TVL ${tvl}`}
          </SizableText>
        ) : null}
      </YStack>
    </>
  );
}
