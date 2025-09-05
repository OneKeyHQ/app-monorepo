import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  Alert,
  Dialog,
  Divider,
  Empty,
  HeaderButtonGroup,
  HeaderIconButton,
  Icon,
  Image,
  Page,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  Tabs,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import {
  useNotificationsAtom,
  useNotificationsReadedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import notificationsUtils, {
  NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT,
} from '@onekeyhq/shared/src/utils/notificationsUtils';
import {
  ENotificationPushTopicTypes,
  type INotificationPushMessageListItem,
} from '@onekeyhq/shared/types/notification';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import useFormatDate from '../../../hooks/useFormatDate';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useVersionCompatible } from '../../../hooks/useVersionCompatible';

import type { IListItemProps } from '../../../components/ListItem';

let maxAccountLimitWarningDismissed = false;

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
        icon="CheckRadioOutline"
        title={intl.formatMessage({
          id: ETranslations.global_mark_all_as_confirmation_title_tooltip,
        })}
        onPress={() => {
          Dialog.show({
            icon: 'CheckRadioOutline',
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

  const { title, content, extras } = item.body;
  const { createdAt, readed, msgId } = item;
  const [{ badge }] = useNotificationsAtom();
  const [readedMap] = useNotificationsReadedAtom();
  const imageElement = useMemo(() => {
    if (item.icon) {
      return (
        <Stack
          w={28}
          h={28}
          bg="$bgStrong"
          borderColor="$borderSubdued"
          borderWidth={StyleSheet.hairlineWidth}
          borderRadius="$full"
          ai="center"
          jc="center"
        >
          <Icon name={item.icon} color="$icon" size="$4.5" />
        </Stack>
      );
    }
    // Only render the left image for non-system topics to avoid duplicates
    if (
      extras?.image &&
      item.topicType !== ENotificationPushTopicTypes.system
    ) {
      return <Image size={28} source={{ uri: extras.image }} />;
    }
  }, [extras?.image, item.icon, item.topicType]);
  return (
    <ListItem
      flexDirection="column"
      alignItems="stretch"
      userSelect="none"
      {...rest}
    >
      <XStack alignItems="flex-start" gap="$3" py="$2">
        <YStack>
          {imageElement}
          {!readed && !!badge && !readedMap?.[msgId] ? (
            <Stack
              position="absolute"
              top={0}
              right={0}
              borderRadius="$full"
              bg="$bgCriticalStrong"
              w="$2"
              h="$2"
            />
          ) : null}
        </YStack>
        <YStack flex={1} gap="$0.5">
          <SizableText flex={1} size="$headingSm" numberOfLines={2}>
            {title}
          </SizableText>

          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            flex={1}
            numberOfLines={3}
          >
            {content}
          </SizableText>
          <SizableText
            pt="$0.5"
            size="$bodySm"
            color="$textDisabled"
            flexShrink={0}
          >
            {formatDistanceToNow(new Date(createdAt))}
          </SizableText>
        </YStack>
        {item.topicType === ENotificationPushTopicTypes.system &&
        !!extras?.image ? (
          <Image
            source={{ uri: extras.image }}
            size="$16"
            borderColor="$neutral3"
            borderWidth={StyleSheet.hairlineWidth}
            borderRadius={6}
          />
        ) : null}
      </XStack>
      <XStack pl="$12" position="absolute" bottom={0} left={0} right={0}>
        <Divider borderColor="$neutral3" />
      </XStack>
    </ListItem>
  );
}

const NotificationItemMemo = memo(NotificationItem);

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

function MaxAccountLimitWarning() {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const [
    {
      lastSettingsUpdateTime,
      maxAccountCount = NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT,
    },
  ] = useNotificationsAtom();

  const { result } = usePromiseResult(async () => {
    noop(lastSettingsUpdateTime);
    const serverSettings =
      await backgroundApiProxy.serviceNotification.fetchServerNotificationSettings();
    const enabledAccountCount =
      await backgroundApiProxy.simpleDb.notificationSettings.getEnabledAccountCount();
    return {
      serverSettings,
      enabledAccountCount,
    };
  }, [lastSettingsUpdateTime]);

  const shouldShowMaxAccountLimitWarning = useMemo(
    () =>
      !maxAccountLimitWarningDismissed &&
      result?.serverSettings?.pushEnabled &&
      result?.serverSettings?.accountActivityPushEnabled &&
      result?.enabledAccountCount &&
      result?.enabledAccountCount >= maxAccountCount,
    [
      result?.enabledAccountCount,
      maxAccountCount,
      result?.serverSettings?.accountActivityPushEnabled,
      result?.serverSettings?.pushEnabled,
    ],
  );

  if (!shouldShowMaxAccountLimitWarning) {
    return null;
  }

  return (
    <Alert
      mx="$5"
      mb="$2"
      type="warning"
      title={intl.formatMessage(
        {
          id: ETranslations.notifications_account_reached_limit_alert_title,
        },
        {
          count: maxAccountCount,
        },
      )}
      description={intl.formatMessage({
        id: ETranslations.notifications_account_reached_limit_alert_desc,
      })}
      closable
      onClose={() => {
        maxAccountLimitWarningDismissed = true;
      }}
      action={{
        primary: intl.formatMessage({ id: ETranslations.global_manage }),
        onPrimaryPress: () => {
          navigation.pushModal(EModalRoutes.SettingModal, {
            screen: EModalSettingRoutes.SettingManageAccountActivity,
          });
        },
      }}
    />
  );
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

  const tabs = useMemo(
    () => [
      {
        id: ENotificationPushTopicTypes.all,
        name: intl.formatMessage({ id: ETranslations.global_all }),
      },
      {
        id: ENotificationPushTopicTypes.accountActivity,
        name: intl.formatMessage({
          id: ETranslations.notifications_notifications_account_activity_label,
        }),
      },
      {
        id: ENotificationPushTopicTypes.system,
        name: intl.formatMessage({
          id: ETranslations.global_system,
        }),
      },
    ],

    [intl],
  );

  const tabTitles = useMemo(() => {
    return tabs.map((tab) => tab.name);
  }, [tabs]);
  const focusedTab = useSharedValue<string>(tabs[0].name);
  const {
    result = [],
    isLoading,
    run: reFetchList,
  } = usePromiseResult(
    async () => {
      noop(lastReceivedTime);
      void backgroundApiProxy.serviceNotification.refreshBadgeFromServer();
      const topicType = tabs.find((tab) => tab.name === focusedTab.value)?.id;
      const r = await backgroundApiProxy.serviceNotification.fetchMessageList(
        !topicType || topicType === ENotificationPushTopicTypes.all
          ? undefined
          : [topicType],
      );
      return r;
    },
    [focusedTab.value, lastReceivedTime, tabs],
    {
      watchLoading: true,
      checkIsFocused: false,
    },
  );

  const sectionsData = useMemo(
    () => groupNotificationsByDate(result),
    [result],
  );

  const isVersionCompatible = useVersionCompatible();

  const contentView = useMemo(() => {
    return (
      <SectionList
        useFlashList
        contentContainerStyle={{
          pb: bottom || '$5',
        }}
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
        }) => {
          const itemView = (
            <NotificationItemMemo
              key={item.msgId || index}
              item={item}
              onPress={() => {
                if (isVersionCompatible(item.body.extras?.miniBundlerVersion)) {
                  void notificationsUtils.navigateToNotificationDetail({
                    navigation,
                    message: item.body,
                    notificationAccountId:
                      item?.body?.extras?.params?.accountId,
                    mode: item.body.extras?.mode,
                    payload: item.body.extras?.payload,
                    notificationId:
                      item?.msgId ||
                      item?.body?.extras?.params?.msgId ||
                      item?.body?.extras?.msgId ||
                      '',
                  });
                }
              }}
            />
          );
          return itemView;
        }}
        ListEmptyComponent={
          isLoading || isLoading === undefined ? (
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
          )
        }
        ListFooterComponent={<Stack h={bottom || '$5'} />}
      />
    );
  }, [bottom, intl, isLoading, isVersionCompatible, navigation, sectionsData]);

  const handleTabPress = useCallback(
    (tabName: string) => {
      const tab = tabs.find((i) => i.name === tabName);
      if (tab) {
        focusedTab.value = tab.name;
        void reFetchList();
      }
    },
    [focusedTab, reFetchList, tabs],
  );

  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_notifications })}
        headerRight={renderHeaderRight}
      />
      <Page.Body>
        <Tabs.TabBar
          tabNames={tabTitles}
          onTabPress={handleTabPress}
          focusedTab={focusedTab}
          tabItemStyle={{
            h: 44,
          }}
        />
        <YStack pt="$3" flex={1}>
          <MaxAccountLimitWarning />
          {contentView}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default NotificationList;
