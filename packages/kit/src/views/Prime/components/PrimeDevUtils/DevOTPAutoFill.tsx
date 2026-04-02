import { useMemo } from 'react';

import { SizableText, XStack, useClipboard } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

interface IDevOTPAutoFillProps {
  email: string;
}

export function DevOTPAutoFill({ email }: IDevOTPAutoFillProps) {
  const [devSettings] = useDevSettingsPersistAtom();
  const { copyText } = useClipboard();

  const testAccounts = useMemo(
    () => devSettings.settings?.testAccounts || [],
    [devSettings.settings?.testAccounts],
  );

  // Find matching account by email
  const matchingAccount = useMemo(
    () => testAccounts.find((account) => account.email === email),
    [testAccounts, email],
  );

  if (!matchingAccount) {
    return null;
  }

  return (
    <XStack
      gap="$2"
      alignItems="center"
      justifyContent="center"
      p="$2"
      borderRadius="$2"
      backgroundColor="$bgCriticalSubdued"
      hoverStyle={{ opacity: 0.8 }}
      pressStyle={{ opacity: 0.6 }}
      cursor="pointer"
      onPress={() => copyText(matchingAccount.otp)}
    >
      <SizableText size="$bodyMd" color="$textCritical">
        [DEV] OTP: {matchingAccount.otp} (tap to copy)
      </SizableText>
    </XStack>
  );
}
