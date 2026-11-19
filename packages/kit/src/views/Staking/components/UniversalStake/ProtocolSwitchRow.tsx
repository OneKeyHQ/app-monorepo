import type { ReactNode, Ref } from 'react';

import type { IElement, IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';

import { ProtocolImage } from '../ProtocolDisplayShared';

export function ProtocolSwitchRow({
  logoURI,
  networkLogoURI,
  name,
  subtitle,
  aprElement,
  tvlText,
  isLoading,
  isSwitchEnabled,
  showChevron,
  isExpanded,
  chevronSpace,
  nameAccessory,
  onPress,
  testID,
  keyboardProps,
  ref,
}: {
  logoURI?: string;
  networkLogoURI?: string;
  name: string;
  // Badges after the name
  nameAccessory?: ReactNode;
  subtitle?: string;
  aprElement: ReactNode;
  tvlText?: string;
  isLoading?: boolean;
  isSwitchEnabled: boolean;
  showChevron: boolean;
  // Set when the row opens its list in place under itself rather than in a
  // popover: the chevron turns with the list
  isExpanded?: boolean;
  // The chevron's room left empty, so a row listed under a switch row lines
  // its rate up with the one above
  chevronSpace?: boolean;
  onPress: () => void;
  testID?: string;
  ref?: Ref<IElement>;
  // A tab stop with Enter and Space, where a Popover around it opens on a
  // click only
  keyboardProps?: Pick<
    IXStackProps,
    'tabIndex' | 'onKeyDown' | 'focusVisibleStyle'
  >;
}) {
  let nameLine: ReactNode = (
    <SizableText size="$bodyLgMedium" numberOfLines={1} flex={1}>
      {name}
    </SizableText>
  );
  if (isLoading && !name) {
    nameLine = <Skeleton h="$5" w={96} borderRadius="$2" />;
  } else if (nameAccessory) {
    nameLine = (
      <XStack ai="center" gap="$1.5" minWidth={0}>
        <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
          {name}
        </SizableText>
        {nameAccessory}
      </XStack>
    );
  }
  return (
    <XStack
      ref={ref}
      testID={testID}
      role={isSwitchEnabled ? 'button' : undefined}
      aria-expanded={isSwitchEnabled ? isExpanded : undefined}
      userSelect={isSwitchEnabled ? 'none' : undefined}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      // The logo starts where the amount box's text and the rows below do;
      // a rate with nothing after it ends where their values end, and a
      // chevron's glyph has its own inner space, so less room on its side
      pl="$3.5"
      pr={showChevron || chevronSpace ? '$3' : '$3.5'}
      py="$2"
      bg="$bgSubdued"
      // The amount box's corners, as every block in the form has them
      borderRadius="$3"
      borderCurve="continuous"
      hoverStyle={isSwitchEnabled ? { bg: '$bgHover' } : undefined}
      pressStyle={isSwitchEnabled ? { bg: '$bgActive' } : undefined}
      onPress={isSwitchEnabled ? onPress : undefined}
      {...keyboardProps}
    >
      <XStack flex={1} minWidth={0} gap="$3" alignItems="center">
        <ProtocolImage logoURI={logoURI} networkLogoURI={networkLogoURI} />
        <YStack flex={1} minWidth={0} gap="$0.5">
          {nameLine}
          {/* A long vault name takes a second line in a narrow form, as the
              name is what tells the vaults apart */}
          {subtitle ? (
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={2}>
              {subtitle}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
      <XStack alignItems="center" gap="$1" flexShrink={0}>
        <YStack alignItems="flex-end" gap="$0.5">
          {aprElement}
          {tvlText ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {`TVL ${tvlText}`}
            </SizableText>
          ) : null}
        </YStack>
        {showChevron && isExpanded !== undefined ? (
          // As the form's Details row turns its chevron
          <YStack
            transition="fast"
            animateOnly={ANIMATE_ONLY_TRANSFORM}
            rotate={isExpanded ? '180deg' : '0deg'}
          >
            <Icon
              name="ChevronDownSmallSolid"
              color={isSwitchEnabled ? '$iconSubdued' : '$iconDisabled'}
              size="$5"
            />
          </YStack>
        ) : null}
        {!showChevron && chevronSpace ? <Stack w="$5" h="$5" /> : null}
        {showChevron && isExpanded === undefined ? (
          <Icon
            name="ChevronGrabberVerSolid"
            color={isSwitchEnabled ? '$iconSubdued' : '$iconDisabled'}
            size="$5"
          />
        ) : null}
      </XStack>
    </XStack>
  );
}
