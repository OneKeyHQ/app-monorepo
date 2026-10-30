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
  needsSwap = false,
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
  // Its token isn't what Pay with pays with: a swap comes first
  needsSwap?: boolean;
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
          {/* A long name takes a second line in a narrow column, as the
              name is what tells the offers apart. A token's symbol stays
              whole on one, and its tag wraps under it where the column is
              too narrow for both */}
          <XStack
            ai="center"
            gap="$1.5"
            minWidth={0}
            flexWrap={token ? 'wrap' : undefined}
          >
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={token ? 1 : 2}
              flexShrink={token ? 0 : 1}
              maxWidth="100%"
            >
              {title}
            </SizableText>
            {/* The swap's tag sits by the token it buys; the product's own
                tag (Fixed Rate) by the protocol, under it */}
            {token ? null : nameAccessory}
            {needsSwap ? (
              <Badge badgeType="default" badgeSize="sm" flexShrink={0}>
                <Badge.Text>
                  {intl.formatMessage({ id: ETranslations.global_swap })}
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
          <YStack pl="$12" pr={isChoice ? '$9' : undefined}>
            {facts}
          </YStack>
        </HeightTransition>
      ) : null}
    </YStack>
  );
}
