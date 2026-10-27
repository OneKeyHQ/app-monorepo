import { useCallback } from 'react';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';

import { ProtocolImage } from '../../../Staking/components/ProtocolDisplayShared';
import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import { buildOfferRowProps } from './EarnRouterOffer';

import type { IEarnDesktopHoldOffer } from '../../components/desktopHome/earnDesktopHome.utils';

export const EARN_OFFER_OPTION_HEIGHT = 74;

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
  testID?: string;
}) {
  const handlePress = useCallback(() => onSelect?.(offer), [offer, onSelect]);
  const handleHoverIn = useCallback(
    () => onHoverIn?.(offer),
    [offer, onHoverIn],
  );
  const isChoice = Boolean(onSelect);
  const { logoURI, name, nameAccessory, subtitle, aprElement, tvlText } =
    buildOfferRowProps(offer);
  const vaultName =
    vaultFirst && offer.kind === 'protocol' && !offer.isFixedRate
      ? offer.item.provider.vaultName
      : undefined;
  const title = vaultName || name;
  const caption = vaultName ? name : subtitle;
  return (
    <XStack
      testID={testID}
      role={isChoice ? 'radio' : undefined}
      aria-checked={isChoice ? isSelected : undefined}
      ai="center"
      gap="$3"
      px="$4"
      py="$3.5"
      minHeight={EARN_OFFER_OPTION_HEIGHT}
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
      <ProtocolImage logoURI={logoURI} networkLogoURI={networkLogoURI} />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <XStack ai="center" gap="$1.5" minWidth={0}>
          {/* A long name takes a second line in a narrow column, as the
              name is what tells the offers apart */}
          <SizableText size="$bodyLgMedium" numberOfLines={2} flexShrink={1}>
            {title}
          </SizableText>
          {nameAccessory}
        </XStack>
        {caption ? (
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
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
  );
}
