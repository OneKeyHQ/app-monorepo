import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// import PassCodeProtectionSwitch from '../container/PassCodeProtectionSwitch';

const PassCodeProtectionDialogContent = () => {
  const intl = useIntl();
  return (
    <XStack alignItems="center" gap="$3">
      <SizableText size="$bodyMdMedium" flex={1}>
        {intl.formatMessage({
          id: ETranslations.settings_reset_app_description,
        })}
      </SizableText>
      {/* <PassCodeProtectionSwitch /> */}
    </XStack>
  );
};

export default PassCodeProtectionDialogContent;
