import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  HeightTransition,
  Icon,
  Image,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ProtocolImage } from '../../../Staking/components/ProtocolDisplayShared';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { LIST_FOLD_MS } from '../../utils/earnListMotion';

import {
  buildOfferRowProps,
  getOfferTarget,
  hasOfferBadges,
} from './EarnRouterOffer';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

export const EARN_OFFER_OPTION_HEIGHT = 74;
// The card's padding over and under its row
const CARD_PY = 14;

// A tag's color, by what the server calls it (a bonus is a success) or by
// what the mark is (a bridge or a swap informs)
const MARK_TONES = {
  default: { bg: '$bgStrong', color: '$iconSubdued' },
  success: { bg: '$bgSuccess', color: '$iconSuccess' },
  info: { bg: '$bgInfo', color: '$iconInfo' },
  warning: { bg: '$bgCaution', color: '$iconCaution' },
  critical: { bg: '$bgCritical', color: '$iconCritical' },
} as const;

// A tag as a mark after the name, where words crowded the card: the
// network by its logo, a bonus a star, a bridge a bridge. Its words come
// on hover, and to a screen reader
function OfferMark({
  label,
  icon,
  imageUri,
  tone = 'default',
  testID,
}: {
  label: string;
  icon?: IKeyOfIcons;
  imageUri?: string;
  tone?: string;
  testID?: string;
}) {
  const colors =
    MARK_TONES[tone as keyof typeof MARK_TONES] ?? MARK_TONES.default;
  return (
    <Tooltip
      placement="top"
      renderContent={label}
      renderTrigger={
        <Stack
          testID={testID}
          aria-label={label}
          w="$5"
          h="$5"
          ai="center"
          jc="center"
          flexShrink={0}
          borderRadius="$full"
          bg={imageUri ? undefined : colors.bg}
        >
          {imageUri ? (
            <Image
              w="$5"
              h="$5"
              borderRadius="$full"
              source={{ uri: imageUri }}
            />
          ) : null}
          {!imageUri && icon ? (
            <Icon name={icon} size="$3.5" color={colors.color} />
          ) : null}
        </Stack>
      }
    />
  );
}

// Comparing a kind of token, the token leads: its logo, the protocol's on
// it where a network's would be
function TokenOnProtocolImage({
  tokenLogoURI,
  protocolLogoURI,
}: {
  tokenLogoURI?: string;
  protocolLogoURI?: string;
}) {
  return (
    <Stack position="relative" w="$9" h="$9" flexShrink={0}>
      <Token size="md" tokenImageUri={tokenLogoURI} m="$0.5" />
      {protocolLogoURI ? (
        <Stack
          position="absolute"
          bottom={-2}
          right={-2}
          p={1}
          bg="$bgApp"
          borderRadius="$1.5"
        >
          <Image
            w="$4"
            h="$4"
            borderRadius="$1"
            source={{ uri: protocolLogoURI }}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

// An offer as a choice, as the Swap page lists its routes: every option a
// card in view, the one picked a lighter card with a check, no border, so a
// pick only moves the check. The guide's vault step and the deposit modal's
// protocols share it. Name and rate as the deposit modal's rows write them,
// TVL under the rate
export function EarnOfferOptionCard({
  offer,
  networkLogoURI,
  isSelected = false,
  onSelect,
  onHoverIn,
  vaultFirst = false,
  token,
  payRoute,
  networkName,
  facts,
  testID,
}: {
  offer: IEarnDesktopHoldOffer;
  networkLogoURI?: string;
  isSelected?: boolean;
  // A choice; without it the card only names the offer
  onSelect?: (offer: IEarnDesktopHoldOffer) => void;
  // The pointer over it, to read its form ahead
  onHoverIn?: (offer: IEarnDesktopHoldOffer) => void;
  // The vault's own name first, the protocol under it (the guide names
  // vaults); a market or a fixed rate keeps the protocol first either way
  vaultFirst?: boolean;
  // Comparing a kind of token: the token the card holds, named first, the
  // protocol and its vault under it
  token?: { symbol: string; logoURI?: string };
  // What comes before its deposit: a swap (another token on its network)
  // or a bridge (Pay with's token is on another network)
  payRoute?: 'swap' | 'bridge';
  // The cards span networks (All Networks): the card's own, by its name
  networkName?: string;
  // Under the row while the card is picked: what tells the offer apart. It
  // unfolds as the card is picked and folds as another is
  facts?: ReactNode;
  testID?: string;
}) {
  const handlePress = useCallback(() => onSelect?.(offer), [offer, onSelect]);
  const handleHoverIn = useCallback(
    () => onHoverIn?.(offer),
    [offer, onHoverIn],
  );
  const isChoice = Boolean(onSelect);
  const intl = useIntl();
  const { logoURI, name, subtitle, aprElement, tvlText } = buildOfferRowProps(
    offer,
    { intl, isOnPicked: isSelected },
  );
  const serverBadges =
    offer.kind === 'protocol' ? offer.item.provider.badges : undefined;
  const vaultName =
    vaultFirst && offer.kind === 'protocol' && !offer.isFixedRate
      ? offer.item.provider.vaultName
      : undefined;
  let title = vaultName || name;
  let caption = vaultName ? name : subtitle;
  if (token) {
    title = token.symbol;
    caption = getOfferTarget(offer);
  }
  const hasTags = Boolean(networkName || payRoute || hasOfferBadges(offer));
  return (
    <YStack
      testID={testID}
      role={isChoice ? 'radio' : undefined}
      aria-checked={isChoice ? isSelected : undefined}
      px="$4"
      py={CARD_PY}
      bg={isSelected ? '$bgActive' : '$bgSubdued'}
      borderRadius="$3"
      borderCurve="continuous"
      userSelect={isChoice ? 'none' : undefined}
      cursor={isChoice ? 'pointer' : undefined}
      hoverStyle={isChoice && !isSelected ? { bg: '$bgHover' } : undefined}
      pressStyle={isChoice ? { bg: '$bgActive' } : undefined}
      onPress={isChoice ? handlePress : undefined}
      onHoverIn={onHoverIn ? handleHoverIn : undefined}
      {...(isChoice ? buildKeyboardPressProps(handlePress, 2) : undefined)}
    >
      <XStack
        ai="center"
        gap="$3"
        minHeight={EARN_OFFER_OPTION_HEIGHT - CARD_PY * 2}
      >
        {token ? (
          <TokenOnProtocolImage
            tokenLogoURI={token.logoURI}
            protocolLogoURI={logoURI}
          />
        ) : (
          <ProtocolImage logoURI={logoURI} networkLogoURI={networkLogoURI} />
        )}
        <YStack flex={1} minWidth={0} gap="$0.5">
          {/* The name that tells the offers apart, its tags as marks after
              it, and under them what the offer holds. As words the tags
              crowded the card (11-10): a mark each keeps them on the
              name's line, and a name too long for that sends them to the
              next */}
          <XStack
            ai="center"
            columnGap="$1.5"
            rowGap="$0.5"
            minWidth={0}
            flexWrap="wrap"
          >
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={1}
              flexShrink={1}
              minWidth={0}
            >
              {title}
            </SizableText>
            {hasTags ? (
              <XStack
                testID={testID ? `${testID}-tags` : undefined}
                ai="center"
                gap="$1"
                flexShrink={0}
              >
                {/* The network, where the cards span networks */}
                {networkName && networkLogoURI ? (
                  <OfferMark label={networkName} imageUri={networkLogoURI} />
                ) : null}
                {networkName && !networkLogoURI ? (
                  <Badge badgeType="default" badgeSize="sm" flexShrink={0}>
                    <Badge.Text>{networkName}</Badge.Text>
                  </Badge>
                ) : null}
                {offer.isFixedRate ? (
                  <OfferMark
                    label={intl.formatMessage({
                      id: ETranslations.defi_fixed_rate,
                    })}
                    icon="LockOutline"
                  />
                ) : null}
                {/* The protocol's own tags, a bonus above all: a star in
                    the tag's color */}
                {serverBadges?.map((badge) => (
                  <OfferMark
                    key={badge.tag}
                    label={badge.tag}
                    icon="StarSolid"
                    tone={badge.badgeType}
                  />
                ))}
                {/* What comes before the deposit */}
                {payRoute ? (
                  <OfferMark
                    testID={`earn-offer-pay-route-${payRoute}`}
                    label={intl.formatMessage({
                      id:
                        payRoute === 'bridge'
                          ? ETranslations.swap_page_bridge
                          : ETranslations.global_swap,
                    })}
                    icon={
                      payRoute === 'bridge'
                        ? 'BridgeOutline'
                        : 'SwitchHorOutline'
                    }
                    tone="info"
                  />
                ) : null}
              </XStack>
            ) : null}
          </XStack>
          {caption ? (
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              numberOfLines={token ? 1 : 2}
            >
              {caption}
            </SizableText>
          ) : null}
        </YStack>
        <YStack ai="flex-end" gap="$0.5" flexShrink={0}>
          {aprElement}
          {tvlText ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {`TVL ${tvlText}`}
            </SizableText>
          ) : null}
        </YStack>
        {isChoice ? (
          <Icon
            name={isSelected ? 'CheckRadioSolid' : 'CirclePlaceholderOnOutline'}
            color={isSelected ? '$iconSuccess' : '$iconSubdued'}
            size="$6"
            flexShrink={0}
          />
        ) : null}
      </XStack>
      {facts ? (
        <HeightTransition
          hide={!isSelected}
          duration={LIST_FOLD_MS}
          skipInitialAnimation
        >
          {/* Under the name, and its values end where the rate does */}
          {/* The width of the card's row, from the logo's edge: the facts
              are a panel of their own under it */}
          <YStack>{facts}</YStack>
        </HeightTransition>
      ) : null}
    </YStack>
  );
}
