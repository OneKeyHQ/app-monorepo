import { useMemo } from 'react';

import {
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function DevTestAccountSelector() {
  const [devSettings] = useDevSettingsPersistAtom();
  const { copyText } = useClipboard();

  const testAccounts = useMemo(
    () => devSettings.settings?.testAccounts || [],
    [devSettings.settings?.testAccounts],
  );

  if (testAccounts.length === 0) {
    return null;
  }

  return (
    <YStack
      gap="$1"
      p="$2"
      borderRadius="$2"
      backgroundColor="$bgCriticalSubdued"
    >
      <SizableText size="$bodySm" color="$textCritical">
        [DEV] Test Accounts (tap to copy):
      </SizableText>
      {testAccounts.map((account) => (
        <XStack
          key={account.id}
          gap="$2"
          alignItems="center"
          p="$1.5"
          borderRadius="$1"
          borderWidth={1}
          borderColor="$borderCritical"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
          cursor="pointer"
          onPress={() => copyText(account.email)}
        >
          <SizableText size="$bodySm" color="$textCritical" numberOfLines={1}>
            {account.name ? `${account.name}: ` : ''}
            {account.email}
          </SizableText>
        </XStack>
      ))}
    </YStack>
  );
}
