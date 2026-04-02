import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Dialog, Icon, Stack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

function BulkSendModeIcon({ name }: { name: IKeyOfIcons }) {
  return (
    <Stack
      w="$9"
      h="$9"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Icon name={name} size="$6" color="$iconSubdued" />
    </Stack>
  );
}

export function useBulkSendModeDialog() {
  const intl = useIntl();

  const bulkSendModeOptions = useMemo(
    () => [
      {
        mode: EBulkSendMode.OneToMany,
        icon: 'BulkSendOneToManyOutline' as IKeyOfIcons,
        title: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_one_to_many,
        }),
        subtitle: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_one_to_many_subtitle,
        }),
      },
      {
        mode: EBulkSendMode.ManyToOne,
        icon: 'BulkSendManyToOneOutline' as IKeyOfIcons,
        title: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_many_to_one,
        }),
        subtitle: intl.formatMessage({
          id: ETranslations.wallet_bulk_send_mode_many_to_one_subtitle,
        }),
      },
      {
        mode: EBulkSendMode.ManyToMany,
        icon: 'BulkSendManyToManyOutline' as IKeyOfIcons,
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
                renderIcon={<BulkSendModeIcon name={option.icon} />}
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
