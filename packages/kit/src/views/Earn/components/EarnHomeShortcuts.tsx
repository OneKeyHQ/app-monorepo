import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';

import { EarnTestIDs } from '../testIDs';

function EarnHomeShortcut({
  icon,
  label,
  testID,
  onPress,
}: {
  icon: IKeyOfIcons;
  label: string;
  testID: string;
  onPress?: () => void;
}) {
  return (
    <YStack
      testID={testID}
      role={onPress ? 'button' : undefined}
      w={73.667}
      gap="$1"
      ai="center"
      jc="center"
      cursor={onPress ? 'pointer' : undefined}
      userSelect="none"
      pressStyle={onPress ? { opacity: 0.5 } : undefined}
      onPress={onPress}
    >
      <YStack p="$1.5" borderRadius="$3" bg="$bgSubdued">
        <Icon name={icon} size="$6" color="$iconStrong" />
      </YStack>
      <SizableText
        w="100%"
        size="$headingSm"
        letterSpacing={-0.15}
        textAlign="center"
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </YStack>
  );
}

export function EarnHomeShortcuts({
  onOpenLoans,
}: {
  onOpenLoans: () => void;
}) {
  // FIXME: Replace these labels with product-approved i18n keys once available.
  return (
    <XStack px="$pagePadding" pb="$5" jc="space-between">
      <EarnHomeShortcut
        icon="DollarOutline"
        label="Tokens"
        testID={EarnTestIDs.homeShortcut('tokens')}
      />
      <EarnHomeShortcut
        icon="HandCoinsOutline"
        label="Loans"
        testID={EarnTestIDs.borrowEntryButton}
        onPress={onOpenLoans}
      />
      <EarnHomeShortcut
        icon="FileTextOutline"
        label="Protocols"
        testID={EarnTestIDs.homeShortcut('protocols')}
      />
    </XStack>
  );
}
