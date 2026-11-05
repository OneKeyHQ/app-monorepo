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
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ProtocolImage } from '../../../Staking/components/ProtocolDisplayShared';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';
import { LIST_FOLD_MS } from '../../utils/earnListMotion';

import { buildOfferRowProps, getOfferTarget } from './EarnRouterOffer';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

export const EARN_OFFER_OPTION_HEIGHT = 74;
// The card's padding over and under its row
const CARD_PY = 14;

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
  const { logoURI, name, nameAccessory, subtitle, aprElement, tvlText } =
    buildOfferRowProps(offer, { intl, isOnPicked: isSelected });
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
          {/* The name is what tells the offers apart: it keeps its width,
              a long one taking a second line of its own, and the tags beside
              it go under it where the column is too narrow for them all
              (a network and a bridge across networks, 11-05) */}
          <XStack
            ai="center"
            columnGap="$1.5"
            rowGap="$1"
            minWidth={0}
            flexWrap="wrap"
          >
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={token ? 1 : 2}
              flexShrink={0}
              maxWidth="100%"
            >
              {title}
            </SizableText>
            {/* The network, as the wallet's token list tells a token's
                networks apart; then the swap's or the bridge's tag by the
                token it buys; the product's own tag (Fixed Rate) by the
                protocol, under it */}
            {networkName ? (
              <Badge badgeType="default" badgeSize="sm" flexShrink={0}>
                <Badge.Text>{networkName}</Badge.Text>
              </Badge>
            ) : null}
            {token ? null : nameAccessory}
            {payRoute ? (
              <Badge
                testID={`earn-offer-pay-route-${payRoute}`}
                // Apart from the grey network beside it: what happens, not
                // where
                badgeType="info"
                badgeSize="sm"
                flexShrink={0}
              >
                <Badge.Text>
                  {intl.formatMessage({
                    id:
                      payRoute === 'bridge'
                        ? ETranslations.swap_page_bridge
                        : ETranslations.global_swap,
                  })}
                </Badge.Text>
              </Badge>
            ) : null}
          </XStack>
          {caption || (token && nameAccessory) ? (
            <XStack
              ai="center"
              gap="$1.5"
              minWidth={0}
              flexWrap={token ? 'wrap' : undefined}
            >
              {caption ? (
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={token ? 1 : 2}
                  flexShrink={token ? 0 : 1}
                  maxWidth="100%"
                >
                  {caption}
                </SizableText>
              ) : null}
              {token ? nameAccessory : null}
            </XStack>
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
