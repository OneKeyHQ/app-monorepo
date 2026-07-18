import { memo } from 'react';

import { Icon, Stack, XStack } from '@onekeyhq/components';

import BulkExportHistoryNetworkAvatars from './BulkExportHistoryNetworkAvatars';

function BulkExportHistoryNetworkTrigger({
  selectedNetworkIds,
  disabled,
  onPress,
}: {
  selectedNetworkIds: string[];
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Stack
      userSelect="none"
      onPress={disabled ? undefined : onPress}
      flexDirection="row"
      alignItems="center"
      borderRadius="$3"
      borderWidth={1}
      borderCurve="continuous"
      borderColor="$borderStrong"
      px="$3"
      py="$2"
      testID="bulk-export-history-network-trigger"
      {...(!disabled && {
        hoverStyle: {
          bg: '$bgHover',
        },
        pressStyle: {
          bg: '$bgActive',
        },
      })}
      {...(disabled && {
        opacity: 0.5,
      })}
    >
      <XStack flex={1} minWidth={0} alignItems="center" gap="$3">
        <BulkExportHistoryNetworkAvatars
          networkIds={selectedNetworkIds}
          showNames
          nameTextProps={{
            size: '$bodyLg',
            numberOfLines: 1,
            testID: 'bulk-export-history-network-trigger-text',
          }}
        />
      </XStack>
      <Icon name="ChevronDownSmallOutline" mr="$-0.5" color="$iconSubdued" />
    </Stack>
  );
}

export default memo(BulkExportHistoryNetworkTrigger);
