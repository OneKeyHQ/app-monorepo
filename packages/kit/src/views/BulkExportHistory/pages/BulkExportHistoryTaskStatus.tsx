import type { ComponentProps } from 'react';

import { SizableText, Spinner, Stack, XStack } from '@onekeyhq/components';

import type { IExportHistoryTaskStatusMeta } from './bulkExportHistoryTaskUtils';

type IBulkExportHistoryTaskStatusProps = {
  label: string;
  statusMeta: IExportHistoryTaskStatusMeta;
} & Omit<ComponentProps<typeof XStack>, 'children'>;

function BulkExportHistoryTaskStatus({
  label,
  statusMeta,
  ...stackProps
}: IBulkExportHistoryTaskStatusProps) {
  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      flexShrink={0}
      accessibilityLiveRegion="polite"
      accessibilityState={{ busy: statusMeta.isInProgress }}
      {...stackProps}
    >
      {statusMeta.displayStatus === 'processing' ? (
        <Spinner
          size="small"
          color={statusMeta.statusIndicatorColor}
          scale={0.65}
        />
      ) : (
        <Stack
          w="$1.5"
          h="$1.5"
          borderRadius="$full"
          bg={statusMeta.statusIndicatorColor}
          flexShrink={0}
        />
      )}
      <SizableText
        size="$bodyMd"
        color={statusMeta.statusTextColor}
        numberOfLines={1}
      >
        {label}
      </SizableText>
    </XStack>
  );
}

export default BulkExportHistoryTaskStatus;
