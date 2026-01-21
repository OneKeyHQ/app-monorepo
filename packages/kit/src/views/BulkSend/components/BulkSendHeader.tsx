import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
import type { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';

function BulkSendHeader({ bulkSendMode }: { bulkSendMode: EBulkSendMode }) {
  const media = useMedia();

  if (!media.gtMd) return null;

  return (
    <YStack gap="$1" mb="$6">
      <SizableText size="$heading2xl">Bulk Send</SizableText>
      <XStack gap="$1" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {bulkSendUtils.getBulkSendModeLabel(bulkSendMode)}
        </SizableText>
      </XStack>
    </YStack>
  );
}

export default BulkSendHeader;
