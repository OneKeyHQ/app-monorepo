import { useCallback, useMemo } from 'react';

import { Icon, Page, SectionList, Stack } from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components/src/primitives';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import useLiteCard from '../../hooks/useLiteCard';

import { Header } from './Header';

const CREATE_LITE_CARD_SECTION_LIST = (
  liteCard: ReturnType<typeof useLiteCard>,
) => [
  {
    title: 'General',
    data: [
      {
        icon: 'FolderUploadOutline',
        title: 'Back up',
        detail: 'Backup your recovery phrase to OneKey Lite',
        onPress: liteCard.backupWallet,
      },
      {
        icon: 'FolderDownloadOutline',
        title: 'Import',
        detail: 'Import recovery phrase from your OneKey Lite',
        onPress: liteCard.importWallet,
      },
    ],
  },
  {
    title: 'Advanced',
    data: [
      {
        icon: 'PasswordOutline',
        title: 'Change PIN',
        onPress: liteCard.changePIN,
      },
      {
        icon: 'RenewOutline',
        title: 'Reset',
        isCritical: true,
        onPress: liteCard.reset,
      },
    ],
  },
];

export default function Home() {
  const liteCard = useLiteCard();
  const sections = useMemo(
    () => CREATE_LITE_CARD_SECTION_LIST(liteCard),
    [liteCard],
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
