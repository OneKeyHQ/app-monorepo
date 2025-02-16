import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function DeviceQrInfoSection() {
  const intl = useIntl();

  return (
    <YStack py="$5" gap="$5">
      <YStack>
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_about_qr_details_question_a,
          })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_about_qr_details_answer_a,
          })}
        </SizableText>
      </YStack>
      <YStack>
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_about_qr_details_question_b,
          })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_about_qr_details_answer_b,
          })}
        </SizableText>
      </YStack>
    </YStack>
  );
}

export default DeviceQrInfoSection;
