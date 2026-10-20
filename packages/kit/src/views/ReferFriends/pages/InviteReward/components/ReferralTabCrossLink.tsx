import { Icon, SizableText, XStack } from '@onekeyhq/components';

import { PRESSABLE_SURFACE_PROPS } from './useInviteCardStyle';

// A quiet line at the end of each tab pointing to the other one, so the two
// read as the two sides of referrals rather than two versions of one page.
export function ReferralTabCrossLink({
  prompt,
  action,
  onPress,
  testID,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <XStack
      px="$pagePadding"
      pt="$8"
      jc="center"
      ai="center"
      gap="$1.5"
      flexWrap="wrap"
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        {prompt}
      </SizableText>
      <XStack
        testID={testID}
        ai="center"
        gap="$1"
        px="$1"
        mx="$-1"
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
