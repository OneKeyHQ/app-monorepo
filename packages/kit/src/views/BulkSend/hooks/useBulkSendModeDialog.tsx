import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Icon, Stack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

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
  const intl = useIntl();

  const bulkSendModeOptions = useMemo(
    () => [
      {
        mode: EBulkSendMode.OneToMany,
        title: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_one_to_many,
        }),
        subtitle: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_one_to_many_subtitle,
        }),
      },
      {
        mode: EBulkSendMode.ManyToOne,
        title: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_many_to_one,
        }),
        subtitle: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_many_to_one_subtitle,
        }),
      },
      {
        mode: EBulkSendMode.ManyToMany,
        title: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_many_to_many,
        }),
        subtitle: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_many_to_many_subtitle,
        }),
      },
    ],
    [intl],
  );

  const showBulkSendModeDialog = useCallback(
    ({ onSelect }: { onSelect: (mode: EBulkSendMode) => void }) => {
      const dialog = Dialog.show({
        icon: 'ChevronDoubleUpOutline',
        title: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_select_mode_title,
        }),
        showFooter: false,
        renderContent: (
          <YStack mx="$-5">
            {bulkSendModeOptions.map((option) => (
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
    [intl, bulkSendModeOptions],
  );

  return showBulkSendModeDialog;
}
