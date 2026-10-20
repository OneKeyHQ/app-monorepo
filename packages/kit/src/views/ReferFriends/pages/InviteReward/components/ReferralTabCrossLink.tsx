import { Icon, SizableText, XStack } from '@onekeyhq/components';

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
        role="button"
        cursor="default"
        // A text link: feedback dims the text instead of filling a surface
        // around it, and the slop gives it a 44px touch target.
        hoverStyle={{ opacity: 0.8 }}
        pressStyle={{ opacity: 0.6 }}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
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
