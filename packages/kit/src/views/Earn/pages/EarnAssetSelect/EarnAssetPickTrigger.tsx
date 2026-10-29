import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { buildKeyboardPressProps } from '../../components/desktopHome/earnDesktopPressable';

import { getEarnAssetClassLabel } from './earnAssetClassLabel';
import { EarnAssetLogos } from './EarnAssetLogos';
import { sortAssetSelectTokens } from './earnAssetSelect.utils';

import type {
  IEarnAssetPick,
  IEarnAssetSelectPurpose,
  IEarnAssetSelectToken,
} from './earnAssetSelect.utils';

/**
 * The pick: the token, or a kind's first logos and its name, with the
 * chevron of a list. A press opens the selector. As a pill (the windows'
 * forms) it is a filled control at the head of the form, where it is seen
 * and has the column's width; as a title it is plain text in a header
 */
export function EarnAssetPickTrigger({
  pick,
  tokens,
  purpose,
  fallbackLogoURI,
  networkLogoURI,
  variant = 'title',
  isLeading = true,
  testID = 'earn-asset-pick-trigger',
  onPress,
}: {
  variant?: 'title' | 'pill';
  pick: IEarnAssetPick;
  tokens: IEarnAssetSelectToken[];
  purpose: IEarnAssetSelectPurpose;
  // The token's logo before the list is in
  fallbackLogoURI?: string;
  // The pill's token carries its chain, as the amount box's token does
  networkLogoURI?: string;
  // First in the title: its text starts where a plain title's would
  isLeading?: boolean;
  testID?: string;
  onPress: () => void;
}) {
  const intl = useIntl();
  const kindLogos = useMemo(
    () =>
      pick.kind === 'class'
        ? sortAssetSelectTokens(
            tokens.filter((token) => token.type === pick.assetClass),
            purpose,
          ).map((token) => token.logoURI)
        : [],
    [pick, purpose, tokens],
  );
  const token =
    pick.kind === 'token'
      ? tokens.find(
          (item) => item.symbol.toUpperCase() === pick.symbol.toUpperCase(),
        )
      : undefined;
  const label =
    pick.kind === 'class'
      ? getEarnAssetClassLabel(intl, pick.assetClass)
      : (token?.symbol ?? pick.symbol);
  // The logos' rings take the pill's color as it changes
  const [isHovered, setIsHovered] = useState(false);
  if (variant === 'pill') {
    return (
      <XStack
        testID={testID}
        role="button"
        ai="center"
        gap="$2"
        h="$10"
        // The logo sits concentric with the pill's round end
        pl="$2"
        pr="$3"
        borderRadius="$full"
        borderCurve="continuous"
        bg="$bgStrong"
        hoverStyle={{ bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
        userSelect="none"
        cursor="pointer"
        maxWidth="100%"
        minWidth={0}
        flexShrink={1}
        alignSelf="flex-start"
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
        onPress={onPress}
        {...buildKeyboardPressProps(onPress, 2)}
      >
        {pick.kind === 'class' ? (
          <EarnAssetLogos
            logos={kindLogos}
            size="xs"
            ringColor={isHovered ? '$bgStrongHover' : '$bgStrong'}
          />
        ) : (
          <Token
            size="sm"
            tokenImageUri={token?.logoURI || fallbackLogoURI}
            networkImageUri={networkLogoURI}
          />
        )}
        <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
          {label}
        </SizableText>
        <Icon
          name="ChevronDownSmallOutline"
          size="$5"
          color="$iconSubdued"
          flexShrink={0}
          ml="$-1"
        />
      </XStack>
    );
  }
  return (
    <XStack
      testID={testID}
      role="button"
      ai="center"
      gap="$2"
      // The title's text stays where a plain title's would start; the right
      // margin gives the room back, so a title sized to its content keeps
      // the whole label
      ml={isLeading ? '$-2' : undefined}
      mr={isLeading ? '$2' : undefined}
      px="$2"
      py="$1"
      borderRadius="$2"
      borderCurve="continuous"
      userSelect="none"
      cursor="pointer"
      maxWidth="100%"
      minWidth={0}
      flexShrink={1}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
      {...buildKeyboardPressProps(onPress, 2)}
    >
      {pick.kind === 'class' ? (
        <EarnAssetLogos logos={kindLogos} size="xs" />
      ) : (
        <Token size="sm" tokenImageUri={token?.logoURI || fallbackLogoURI} />
      )}
      <SizableText size="$headingLg" numberOfLines={1} flexShrink={1}>
        {label}
      </SizableText>
      <Icon
        name="ChevronDownSmallOutline"
        size="$5"
        color="$iconSubdued"
        flexShrink={0}
      />
    </XStack>
  );
}
