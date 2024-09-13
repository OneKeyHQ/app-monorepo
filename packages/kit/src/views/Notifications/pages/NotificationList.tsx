import { useCallback, useEffect, useRef } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Empty,
  HeaderButtonGroup,
  HeaderIconButton,
  Page,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import {
  useNotificationsAtom,
  useNotificationsReadedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import type { INotificationPushMessageListItem } from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useFormatDate from '../../../hooks/useFormatDate';
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
  const { formatDistanceToNow } = useFormatDate();

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
          {formatDistanceToNow(new Date(createdAt))}
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
  const navigation = useAppNavigation();
  const renderHeaderRight = useCallback(() => <HeaderRight />, []);
  const [{ lastReceivedTime, firstTimeGuideOpened }, setNotificationsData] =
    useNotificationsAtom();

  const isFirstTimeGuideOpened = useRef(false);

  useEffect(() => {
    if (!firstTimeGuideOpened && !isFirstTimeGuideOpened.current) {
      // showNotificationPermissionsDialog();
      navigation.pushModal(EModalRoutes.NotificationsModal, {
        screen: EModalNotificationsRoutes.NotificationIntroduction,
      });
      isFirstTimeGuideOpened.current = true;
      setNotificationsData((v) => ({
        ...v,
        firstTimeGuideOpened: true,
      }));
    }
  }, [firstTimeGuideOpened, navigation, setNotificationsData]);

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
      checkIsFocused: false,
    },
  );
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_notifications })}
        headerRight={renderHeaderRight}
      />
      <Page.Body>
        {isLoading && !result?.length ? (
          <Stack gap="$1.5" px="$5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Stack key={index} gap="$1" py="$2">
                <Stack py="$1">
                  <Skeleton h="$3" w="$16" />
                </Stack>
                <Stack py="$1">
                  <Skeleton h="$3" w="$48" />
                </Stack>
              </Stack>
            ))}
          </Stack>
        ) : (
          <>
            {!result?.length ? (
              <Empty
                pt={170}
                icon="BellOutline"
                title={intl.formatMessage({
                  id: ETranslations.notifications_empty_title,
                })}
                description={intl.formatMessage({
                  id: ETranslations.notifications_empty_desc,
                })}
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
                    navigation,
                    message: item.body,
                    notificationId:
                      item?.msgId ||
                      item?.body?.extras?.params?.msgId ||
                      item?.body?.extras?.msgId ||
                      '',
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
