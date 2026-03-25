import { useCallback } from 'react';

import { Dialog, Icon, Stack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

const BULK_SEND_MODE_OPTIONS = [
  {
    mode: EBulkSendMode.OneToMany,
    title: 'One-to-many',
    subtitle: 'Send crypto from one address to multiple addresses in bulk',
  },
  {
    mode: EBulkSendMode.ManyToOne,
    title: 'Many-to-one',
    subtitle: 'Send crypto from multiples addresses to one addresses in bulk',
  },
  {
    mode: EBulkSendMode.ManyToMany,
    title: 'Many-to-many',
    subtitle: 'You can send multiple transactions in bulk',
  },
];

function BulkSendModeIcon() {
  return (
    <Stack
      w="$9"
      h="$9"
      alignSelf="flex-start"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Icon name="PlaceholderOutline" size="$5" color="$iconSubdued" />
    </Stack>
  );
}

export function useBulkSendModeDialog() {
  const showBulkSendModeDialog = useCallback(
    ({ onSelect }: { onSelect: (mode: EBulkSendMode) => void }) => {
      const dialog = Dialog.show({
        icon: 'ChevronDoubleUpOutline',
        title: 'Select bulk send type',
        showFooter: false,
        renderContent: (
          <YStack mx="$-5">
            {BULK_SEND_MODE_OPTIONS.map((option) => (
              <ListItem
                key={option.mode}
                drillIn
                title={option.title}
                subtitle={option.subtitle}
                renderIcon={<BulkSendModeIcon />}
                onPress={() => {
                  void dialog.close();
                  onSelect(option.mode);
                }}
              />
            ))}
          </YStack>
        ),
      });
    },
    [],
  );

  return showBulkSendModeDialog;
}
