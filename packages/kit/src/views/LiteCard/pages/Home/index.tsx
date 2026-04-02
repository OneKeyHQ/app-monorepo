import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, Page, SectionList, Stack } from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components/src/primitives';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import useLiteCard from '../../hooks/useLiteCard';

import { Header } from './Header';

const CREATE_LITE_CARD_SECTION_LIST = (
  liteCard: ReturnType<typeof useLiteCard>,
  intl: ReturnType<typeof useIntl>,
) => [
  {
    title: intl.formatMessage({ id: ETranslations.global_general }),
    data: [
      {
        icon: 'FolderUploadOutline',
        title: intl.formatMessage({ id: ETranslations.global_backup }),
        detail: intl.formatMessage({
          id: ETranslations.settings_backup_recovery_phrase_to_onekey_lite,
        }),
        onPress: liteCard.backupWallet,
      },
      {
        icon: 'FolderDownloadOutline',
        title: intl.formatMessage({ id: ETranslations.global_import }),
        detail: intl.formatMessage({
          id: ETranslations.settings_import_recovery_phrase_from_onekey_lite,
        }),
        onPress: liteCard.importWallet,
      },
    ],
  },
  {
    title: intl.formatMessage({ id: ETranslations.global_advanced }),
    data: [
      {
        icon: 'PasswordOutline',
        title: intl.formatMessage({ id: ETranslations.settings_change_pin }),
        onPress: liteCard.changePIN,
      },
      {
        icon: 'RenewOutline',
        title: intl.formatMessage({ id: ETranslations.global_reset }),
        isCritical: true,
        onPress: liteCard.reset,
      },
    ],
  },
];

export default function Home() {
  const intl = useIntl();
  const liteCard = useLiteCard();
  const sections = useMemo(
    () => CREATE_LITE_CARD_SECTION_LIST(liteCard, intl),
    [liteCard, intl],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <SectionList.SectionHeader title={section.title} />
    ),
    [],
  );

  const renderItem = useCallback(
    ({
      item,
    }: {
      item: {
        title: string;
        icon: IIconProps['name'];
        detail: string;
        isCritical: boolean;
        onPress: () => void;
      };
    }) => (
      <ListItem
        icon={item.icon}
        title={item.title}
        titleProps={{
          color: item.isCritical ? '$textCritical' : '$text',
        }}
        drillIn
        subtitle={item.detail}
        renderIcon={
          <Stack
            bg={item.isCritical ? '$bgCritical' : '$bgStrong'}
            p="$2"
            borderRadius="$3"
          >
            <Icon
              name={item.icon}
              size="$6"
              color={item.isCritical ? '$iconCritical' : '$icon'}
            />
          </Stack>
        }
        onPress={() => item?.onPress?.()}
      />
    ),
    [],
  );
  return (
    <Page>
      <SectionList
        ListHeaderComponent={Header}
        sections={sections}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        estimatedItemSize="$20"
      />
    </Page>
  );
}
