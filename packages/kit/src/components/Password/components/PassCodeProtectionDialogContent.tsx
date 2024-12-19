import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import PassCodeProtectionSwitch from '../container/PassCodeProtectionSwitch';

const PassCodeProtectionDialogContent = () => {
  const intl = useIntl();
  return (
    <YStack gap="$2">
      <SizableText size="$bodySm" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.auth_Passcode_protection_description,
        })}
      </SizableText>
      <XStack justifyContent="space-between">
        <SizableText size="$bodyMdMedium">
          {intl.formatMessage({
            id: ETranslations.Setting_Reset_app_description,
          })}
        </SizableText>
        <PassCodeProtectionSwitch />
      </XStack>
    </YStack>
  );
};

export default PassCodeProtectionDialogContent;
