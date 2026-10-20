import { Icon, SizableText, XStack } from '@onekeyhq/components';

import { PRESSABLE_SURFACE_PROPS } from './useInviteCardStyle';

// A quiet line at the end of each tab pointing to the other one, so the two
// read as the two sides of referrals rather than two versions of one page.
export function ReferralTabCrossLink({
  prompt,
  action,
  onPress,
  testID,
  pt = '$8',
}: {
  // A qualifier before the link; leave it out when the link says it all.
  prompt?: string;
  action: string;
  onPress: () => void;
  testID: string;
  // Space above the line; the default separates it from a tab's content.
  pt?: '$8' | '$3';
}) {
  return (
    <XStack
      px="$pagePadding"
      pt={pt}
      // In a page-filling column this pushes the line to the bottom; it
      // stays right after the content once the page scrolls.
      mt="auto"
      jc="center"
      ai="center"
      gap="$1.5"
      flexWrap="wrap"
    >
      {prompt ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {prompt}
        </SizableText>
      ) : null}
      <XStack
        testID={testID}
        ai="center"
        gap="$1"
        px="$1"
        mx="$-1"
        // 44px tall to the touch while the text line keeps its place.
        py="$3"
        my="$-3"
        borderRadius="$2"
        {...PRESSABLE_SURFACE_PROPS}
        onPress={onPress}
      >
        <SizableText size="$bodyMdMedium" color="$textInteractive">
          {action}
        </SizableText>
        <Icon name="ArrowRightOutline" size="$4" color="$textInteractive" />
      </XStack>
    </XStack>
  );
}
