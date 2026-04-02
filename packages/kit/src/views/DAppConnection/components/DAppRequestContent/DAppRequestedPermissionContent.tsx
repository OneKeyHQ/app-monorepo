import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function DAppRequestedPermissionContent({
  requestPermissions,
}: {
  requestPermissions?: string[];
}) {
  const intl = useIntl();
  return (
    <YStack gap="$2">
      <SizableText color="$text" size="$headingMd">
        {intl.formatMessage({
          id: ETranslations.dapp_connect_requested_permissions,
        })}
      </SizableText>
      <YStack
        py="$2.5"
        px="$3"
        gap="$3"
        minHeight="$8"
        bg="$bg"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderCurve="continuous"
      >
        {(
          requestPermissions ?? [
            intl.formatMessage({
              id: ETranslations.dapp_connect_view_your_balance_and_activity,
            }),
            intl.formatMessage({
              id: ETranslations.dapp_connect_send_approval_requests,
            }),
          ]
        ).map((text) => (
          <XStack gap="$3" key={text}>
            <Icon name="CheckLargeOutline" color="$icon" size="$5" />
            <SizableText color="$text" size="$bodyMd">
              {text}
            </SizableText>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

export { DAppRequestedPermissionContent };
