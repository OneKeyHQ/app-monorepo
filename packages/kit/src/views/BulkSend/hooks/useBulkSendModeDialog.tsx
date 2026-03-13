import { useCallback } from 'react';

import { Dialog, Icon, YStack } from '@onekeyhq/components';
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
                renderIcon={
                  <Icon
                    name="PlaceholderOutline"
                    size="$6"
                    color="$iconSubdued"
                  />
                }
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
