import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';
import type { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

function BulkSendHeader({
  bulkSendMode,
  onChangeBulkSendMode,
}: {
  bulkSendMode: EBulkSendMode;
  onChangeBulkSendMode?: () => void;
}) {
  const intl = useIntl();
  const media = useMedia();

  if (!media.gtMd) return null;

  return (
    <YStack gap="$1" mb="$6">
      <SizableText size="$heading2xl">
        {intl.formatMessage({ id: ETranslations.wallet_bulk_send_title })}
      </SizableText>
      <XStack gap="$2" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage(
            { id: ETranslations.wallet_bulk_send_header_mode },
            { mode: bulkSendUtils.getBulkSendModeLabel(bulkSendMode) },
          )}
        </SizableText>
        {onChangeBulkSendMode ? (
          <SizableText
            size="$bodyMd"
            color="$textInteractive"
            cursor="pointer"
            hoverStyle={{ opacity: 0.8 }}
            onPress={onChangeBulkSendMode}
          >
            {intl.formatMessage({
              id: ETranslations.wallet_bulk_send_header_change,
            })}
          </SizableText>
        ) : null}
      </XStack>
    </YStack>
  );
}

export default BulkSendHeader;
