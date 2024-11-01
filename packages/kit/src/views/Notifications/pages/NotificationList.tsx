import { useCallback, useEffect, useMemo, useRef } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Empty,
  HeaderButtonGroup,
  HeaderIconButton,
  Page,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  useSafeAreaInsets,
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
      gap="$0.5"
      flexDirection="column"
      alignItems="stretch"
      userSelect="none"
      hoverStyle={{
        bg: '$bgHover',
      }}
      {...rest}
    >
      <XStack alignItems="baseline" gap="$3" pr="$1.5">
        <SizableText flex={1} size="$headingSm" numberOfLines={1}>
          {title}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" flexShrink={0}>
          {formatDistanceToNow(new Date(createdAt))}
        </SizableText>
        {!readed && !!badge && !readedMap?.[msgId] ? (
          <Stack
            position="absolute"
            top="$1.5"
            right="$-2"
            borderRadius="$full"
            bg="$bgCriticalStrong"
            w="$2"
            h="$2"
          />
        ) : null}
      </XStack>
      <SizableText size="$bodyMd" flex={1} maxWidth="$96">
        {content}
      </SizableText>
    </ListItem>
  );
}

function groupNotificationsByDate(
  notifications: INotificationPushMessageListItem[],
): {
  title: string;
  data: INotificationPushMessageListItem[];
}[] {
  if (!notifications?.length) {
    return [];
  }
  return [
    {
      title: 'default',
      data: notifications,
    },
  ];
}

function NotificationList() {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const renderHeaderRight = useCallback(() => <HeaderRight />, []);
  const [{ lastReceivedTime, firstTimeGuideOpened }, setNotificationsData] =
    useNotificationsAtom();

  const isFirstTimeGuideOpened = useRef(false);

  useEffect(() => {
    if (!firstTimeGuideOpened && !isFirstTimeGuideOpened.current) {
      // showNotificationPermissionsDialog();
      setTimeout(() => {
        navigation.pushModal(EModalRoutes.NotificationsModal, {
          screen: EModalNotificationsRoutes.NotificationIntroduction,
        });
      }, 600);
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

  const sectionsData = useMemo(
    () => groupNotificationsByDate(result),
    [result],
  );
  return (
    <Page scrollEnabled safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_notifications })}
        headerRight={renderHeaderRight}
      />
      <Page.Body pb={bottom || '$5'}>
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
            <SectionList
              sections={sectionsData}
              renderSectionHeader={
                ({ section: { title } }) => null // <SectionList.SectionHeader title={title} />
              }
              renderItem={({
                item,
                index,
              }: {
                item: INotificationPushMessageListItem;
                index: number;
              }) => (
                <NotificationItem
                  key={index}
                  item={item}
                  {...(index !== 0 && {
                    mt: '$2.5',
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
              )}
              estimatedItemSize="$20"
              ListEmptyComponent={
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
              }
              ListFooterComponent={<Stack h={bottom || '$5'} />}
            />
          </>
        )}
      </Page.Body>
    </Page>
  );
}

export default NotificationList;
