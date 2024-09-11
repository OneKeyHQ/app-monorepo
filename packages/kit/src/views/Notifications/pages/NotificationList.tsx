import { useCallback } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Empty,
  HeaderButtonGroup,
  HeaderIconButton,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import {
  useNotificationsAtom,
  useNotificationsReadedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import type { INotificationPushMessageListItem } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

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
            onConfirm: async () => {
              await backgroundApiProxy.serviceNotification.markNotificationReadAll();
            },
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
  item,
  ...rest
}: {
  item: INotificationPushMessageListItem;
} & IListItemProps) {
  const { title, content } = item.body;
  const { createdAt, readed, msgId } = item;
  const [{ badge }] = useNotificationsAtom();
  const [readedMap] = useNotificationsReadedAtom();
  return (
    <ListItem
      gap="$1"
      flexDirection="column"
      alignItems="stretch"
      userSelect="none"
      hoverStyle={{
        bg: '$bgHover',
      }}
      {...rest}
    >
      <XStack alignItems="baseline" gap="$3">
        <SizableText flex={1} size="$headingSm" numberOfLines={1}>
          {title}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
          {createdAt}
        </SizableText>
      </XStack>
      <XStack>
        <XStack flex={1}>
          <SizableText size="$bodyMd" flex={1} maxWidth="$96">
            {content}
          </SizableText>
        </XStack>
        {!readed && !!badge && !readedMap?.[msgId] ? (
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

function NotificationList() {
  const intl = useIntl();
  const renderHeaderRight = useCallback(() => <HeaderRight />, []);
  const [{ lastReceivedTime }] = useNotificationsAtom();

  const { result = [], isLoading } = usePromiseResult(
    async () => {
      noop(lastReceivedTime);
      void backgroundApiProxy.serviceNotification.refreshBadgeFromServer();
      const r = await backgroundApiProxy.serviceNotification.fetchMessageList();
      return r;
    },
    [lastReceivedTime],
    {
      watchLoading: true,
    },
  );
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_notifications })}
        headerRight={renderHeaderRight}
      />
      <Page.Body>
        {isLoading ? (
          <Stack pt={240} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <>
            {!result?.length ? (
              <Empty
                title={intl.formatMessage({ id: ETranslations.global_no_data })}
              />
            ) : null}
            {result.map((item, index) => (
              <NotificationItem
                key={index}
                item={item}
                {...(index !== 0 && {
                  mt: '$1.5',
                })}
                onPress={() => {
                  void notificationsUtils.navigateToNotificationDetail({
                    message: item.body,
                    notificationId:
                      item?.msgId || item?.body?.extras?.msgId || '',
                  });
                }}
              />
            ))}
          </>
        )}
      </Page.Body>
    </Page>
  );
}

export default NotificationList;
