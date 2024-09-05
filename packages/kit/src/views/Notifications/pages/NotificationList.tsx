import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  HeaderButtonGroup,
  HeaderIconButton,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';

import type { IListItemProps } from '../../../components/ListItem';

function HeaderRight() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleSettingsButtonPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingNotifications,
    });
  }, [navigation]);

  return (
    <HeaderButtonGroup>
      <HeaderIconButton
        icon="BroomOutline"
        onPress={() => {
          Dialog.show({
            icon: 'BroomOutline',
            title: intl.formatMessage({
              id: ETranslations.global_mark_all_as_confirmation_title,
            }),
            description: intl.formatMessage({
              id: ETranslations.global_mark_all_as_confirmation_desc,
            }),
          });
        }}
      />
      <HeaderIconButton
        icon="SettingsOutline"
        onPress={handleSettingsButtonPress}
      />
    </HeaderButtonGroup>
  );
}

function NotificationItem({
  title,
  description,
  time,
  read,
  ...rest
}: {
  title: string;
  description: string;
  time: string;
  read?: boolean;
} & IListItemProps) {
  return (
    <ListItem
      gap="$1"
      flexDirection="column"
      alignItems="stretch"
      userSelect="none"
      {...rest}
    >
      <XStack alignItems="baseline" gap="$3">
        <SizableText flex={1} size="$headingSm" numberOfLines={1}>
          {title}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
          {time}
        </SizableText>
      </XStack>
      <XStack>
        <XStack flex={1}>
          <SizableText size="$bodyMd" flex={1} maxWidth="$96">
            {description}
          </SizableText>
        </XStack>
        {!read ? (
          <Stack
            m="$1.5"
            borderRadius="$full"
            bg="$bgCriticalStrong"
            w="$2"
            h="$2"
          />
        ) : null}
      </XStack>
    </ListItem>
  );
}

const DATA = [
  {
    title: '💸 Sent',
    description: 'Account #1 0x4EF880...9A296e sent 10 MATIC',
    time: '10:45 AM',
    onPress: () => console.log('sent'),
  },
  {
    title: '🤑 Received',
    description: 'Account #1 0x4EF880...9A296e received 10 MATIC',
    time: 'Yesterday 10:45 AM',
    onPress: () => console.log('received'),
  },
  {
    title: '🎉 Successful trade',
    description:
      'Account #1 0x4EF880...9A296e has successfully traded 10 DAl for 2690 OP',
    time: 'Wednesday 10:45 AM',
    read: true,
    onPress: () => console.log('trade'),
  },
  {
    title: '🔓 Approved USDC on 0x123456...123456',
    description: 'Account #1 0x123456...123456 • Polygon',
    time: 'August 25, 10:45 AM',
    read: true,
    onPress: () => console.log('trade'),
  },
];

function NotificationList() {
  const intl = useIntl();
  const renderHeaderRight = useCallback(() => <HeaderRight />, []);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_notifications })}
        headerRight={renderHeaderRight}
      />
      <Page.Body>
        {DATA.map((item, index) => (
          <NotificationItem
            key={index}
            {...item}
            {...(index !== 0 && {
              mt: '$1.5',
            })}
          />
        ))}
      </Page.Body>
    </Page>
  );
}

export default NotificationList;
