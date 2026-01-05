import { SizableText, Stack, YStack } from '@onekeyhq/components';
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function BulkSendHeader() {
  const intl = useIntl();
  return (
    <YStack gap="$1.5">
      <SizableText size="$bodyMdMedium">
        {intl.formatMessage({
          id: ETranslations.global_asset,
        })}
      </SizableText>
    </YStack>
  );
}

export default BulkSendHeader;
