import { useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Badge, SizableText } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getEarnProviderDisplayName } from '@onekeyhq/shared/types/earn/earnProvider.constants';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { formatTvl } from '../../../Staking/components/ProtocolDisplayShared';
import { getProtocolAprDisplay } from '../../../Staking/components/UniversalStake';
import {
  collectLendingOffers,
  collectNetworkOffers,
} from '../../components/desktopHome/earnDesktopHome.utils';
import { useEarnDesktopMarkets } from '../../components/desktopHome/useEarnDesktopHomeData';
import { EarnAprSuffixText } from '../../components/EarnAprSuffixText';

import {
  buildOffersFirstFrameKey,
  keepFirstFrame,
  readFirstFrame,
} from './earnFirstFrameCache';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';
import type { IntlShape } from 'react-intl';

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
  // The offers the home row counted (or the last read), until these are in
  const firstFrameKey = buildOffersFirstFrameKey({
    accountId,
    networkId,
    symbol,
  });
  const isFetched = Boolean(protocols) && isMarketsLoaded;
  const keptOffers = isFetched
    ? undefined
    : readFirstFrame<IEarnDesktopHoldOffer[]>(firstFrameKey);
  const fetchedOffers = useMemo(() => {
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
  useEffect(() => {
    if (enabled && isFetched && fetchedOffers.length) {
      keepFirstFrame(firstFrameKey, fetchedOffers);
    }
  }, [enabled, fetchedOffers, firstFrameKey, isFetched]);
  const hasKeptOffers = enabled && Boolean(keptOffers?.length);
  return {
    offers: hasKeptOffers && keptOffers ? keptOffers : fetchedOffers,
    isLoaded: isFetched || hasKeptOffers,
  };
}

export const getOfferName = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.marketLabel
    : getEarnProviderDisplayName(offer.item.provider.name);

export const getOfferLogo = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.market.logoURI
    : offer.item.provider.logoURI;

// A vault names itself; a fixed rate says how long is left, as the Earn
// table's row does
export const getOfferSubtitle = (
  offer: IEarnDesktopHoldOffer,
  intl: IntlShape,
) => {
  if (offer.kind === 'lending') {
    return undefined;
  }
  if (!offer.isFixedRate) {
    return offer.item.provider.vaultName;
  }
  const { daysRemaining } = offer.item.provider;
  const days = Number(daysRemaining ?? '');
  return daysRemaining && Number.isFinite(days)
    ? intl.formatMessage(
        { id: ETranslations.earn_number_days_left },
        { number: days },
      )
    : undefined;
};

// Where a deposit goes, in a line: the protocol, then its vault where it has
// one ("Morpho Pangolins USDC"). A vault already named after its protocol
// ("Bitway Absolute Return") stands alone
export const getOfferTarget = (offer: IEarnDesktopHoldOffer) => {
  const name = getOfferName(offer);
  const vaultName =
    offer.kind === 'lending' || offer.isFixedRate
      ? undefined
      : offer.item.provider.vaultName?.trim();
  if (!vaultName) {
    return name;
  }
  return vaultName.toLowerCase().startsWith(name.toLowerCase())
    ? vaultName
    : `${name} ${vaultName}`;
};

export const getOfferTvl = (offer: IEarnDesktopHoldOffer) =>
  offer.kind === 'lending'
    ? offer.offer.tvlText
    : formatTvl(offer.item.provider.tvl);

// What sets the offer apart, after its name: a fixed rate, and the
// protocol's own tags such as a bonus
export function OfferBadges({ offer }: { offer: IEarnDesktopHoldOffer }) {
  const intl = useIntl();
  const badges = offer.kind === 'protocol' ? offer.item.provider.badges : [];
  if (!offer.isFixedRate && !badges?.length) {
    return null;
  }
  return (
    <>
      {offer.isFixedRate ? (
        <Badge badgeType="default" badgeSize="sm">
          <Badge.Text>
            {intl.formatMessage({ id: ETranslations.defi_fixed_rate })}
          </Badge.Text>
        </Badge>
      ) : null}
      {badges?.map((badge) => (
        <Badge key={badge.tag} badgeType={badge.badgeType} badgeSize="sm">
          <Badge.Text>{badge.tag}</Badge.Text>
        </Badge>
      ))}
    </>
  );
}

// On light, the green a picked card's rate takes: dark enough for 4.5:1 on
// the card's grey (4.57 there), where the theme's comes to 4.0
const PICKED_SUCCESS_TEXT_LIGHT = '#1C764E';

// The rate as the protocol switcher's row writes it: with its unit, and
// struck through when the protocol no longer pays it
function OfferSwitchRate({
  offer,
  isOnPicked = false,
}: {
  offer: IEarnDesktopHoldOffer;
  // On a picked card's lighter grey
  isOnPicked?: boolean;
}) {
  const isLight = useThemeVariant() === 'light';
  if (offer.kind === 'lending') {
    return (
      <EarnAprSuffixText
        text={`${new BigNumber(offer.offer.apy).toFixed(2)}% APY`}
        size="$headingLg"
      />
    );
  }
  const display = getProtocolAprDisplay({ protocol: offer.item });
  if (!display) {
    return null;
  }
  return display.textDecorationLine === 'line-through' ? (
    <SizableText
      size="$headingLg"
      color={display.color}
      textDecorationLine="line-through"
    >
      {display.text}
    </SizableText>
  ) : (
    <EarnAprSuffixText
      text={display.text}
      size="$headingLg"
      color={
        isOnPicked && isLight && display.color === '$textSuccess'
          ? PICKED_SUCCESS_TEXT_LIGHT
          : display.color
      }
    />
  );
}

// An offer as the deposit modal's protocol rows show it: the switcher's row,
// the offers it unfolds, and the better rate after a withdrawal
export function buildOfferRowProps(
  offer: IEarnDesktopHoldOffer,
  { intl, isOnPicked }: { intl: IntlShape; isOnPicked?: boolean },
) {
  const tvl = getOfferTvl(offer);
  return {
    logoURI: getOfferLogo(offer),
    name: getOfferName(offer),
    nameAccessory: <OfferBadges offer={offer} />,
    subtitle: getOfferSubtitle(offer, intl),
    aprElement: <OfferSwitchRate offer={offer} isOnPicked={isOnPicked} />,
    tvlText: tvl || undefined,
  };
}
