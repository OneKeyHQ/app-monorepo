import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type {
  ISectionListRef,
  IXStackProps,
  IYStackProps,
} from '@onekeyhq/components';
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
  usePopoverContext,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { ITabBarItemProps } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import { TabBarItem } from '@onekeyhq/components/src/composite/Tabs/TabBar';
import {
  useNotificationsAtom,
  useNotificationsReadedAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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

const canShowNotificationSettings = (() => {
  if (platformEnv.isWebDappMode) {
    // return true;
    return false;
  }
  return true;
})();

function HeaderRight({
  onClearUnread,
  style,
  closePopover,
}: {
  onClearUnread: () => void;
  style?: IXStackProps;
  closePopover?: () => Promise<void>;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleSettingsButtonPress = useCallback(async () => {
    await closePopover?.();
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingNotifications,
    });
  }, [closePopover, navigation]);

  const handleMarkAllReadPress = useCallback(async () => {
    await closePopover?.();
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
        setTimeout(() => {
          onClearUnread();
        }, 100);
      },
    });
  }, [closePopover, intl, onClearUnread]);

  return (
    <HeaderButtonGroup {...style}>
      <HeaderIconButton
        icon="CheckRadioOutline"
        title={intl.formatMessage({
          id: ETranslations.global_mark_all_as_confirmation_title_tooltip,
        })}
        onPress={handleMarkAllReadPress}
      />
      {canShowNotificationSettings ? (
        <HeaderIconButton
          icon="SettingsOutline"
          onPress={handleSettingsButtonPress}
        />
      ) : null}
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

export function NotificationListView({
  showPageHeader = true,
  containerStyle,
}: {
  showPageHeader?: boolean;
  containerStyle?: IYStackProps;
}) {
  const { closePopover } = usePopoverContext();
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const [{ lastReceivedTime, firstTimeGuideOpened }, setNotificationsData] =
    useNotificationsAtom();

  const isFirstTimeGuideOpened = useRef(false);
  const listRef = useRef<ISectionListRef<unknown>>(null);

  useEffect(() => {
    if (
      canShowNotificationSettings &&
      !firstTimeGuideOpened &&
      !isFirstTimeGuideOpened.current
    ) {
      // showNotificationPermissionsDialog();
      void closePopover?.();
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
  }, [closePopover, firstTimeGuideOpened, navigation, setNotificationsData]);

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
  const [
    shouldShowMaxAccountLimitWarning,
    setShouldShowMaxAccountLimitWarning,
  ] = useState(false);
  const [unreadMap, setUnreadMap] = useState<{
    [key: string]: number;
  }>({
    [ENotificationPushTopicTypes.accountActivity]: 0,
    [ENotificationPushTopicTypes.system]: 0,
  });
  const [result, setResult] = useState<INotificationPushMessageListItem[]>([]);
  const cacheListRef = useRef<
    Record<ENotificationPushTopicTypes, INotificationPushMessageListItem[]>
  >({
    [ENotificationPushTopicTypes.all]: [],
    [ENotificationPushTopicTypes.accountActivity]: [],
    [ENotificationPushTopicTypes.coinPriceAlert]: [],
    [ENotificationPushTopicTypes.system]: [],
  });
  const { isLoading, run: reFetchList } = usePromiseResult(
    async () => {
      noop(lastReceivedTime);
      const topicType = tabs.find((tab) => tab.name === focusedTab.value)?.id;
      if (!topicType) return;
      const cacheList = cacheListRef.current[topicType];
      setShouldShowMaxAccountLimitWarning(
        topicType !== ENotificationPushTopicTypes.system,
      );
      setResult(cacheList);
      void backgroundApiProxy.serviceNotification.refreshBadgeFromServer();
      const r = await backgroundApiProxy.serviceNotification.fetchMessageList(
        !topicType || topicType === ENotificationPushTopicTypes.all
          ? undefined
          : [topicType],
      );
      if (topicType === ENotificationPushTopicTypes.all) {
        const hasUnreadMap = r.reduce(
          (acc, item) => {
            if (!item.readed) {
              if (
                item.topicType === ENotificationPushTopicTypes.accountActivity
              ) {
                acc[ENotificationPushTopicTypes.accountActivity] += 1;
              } else if (
                item.topicType === ENotificationPushTopicTypes.system
              ) {
                acc[ENotificationPushTopicTypes.system] += 1;
              }
            }
            return acc;
          },
          {
            [ENotificationPushTopicTypes.accountActivity]: 0,
            [ENotificationPushTopicTypes.system]: 0,
          },
        );
        setUnreadMap(hasUnreadMap);
      }
      if (
        (cacheListRef.current[topicType]?.length || 0) === 0 &&
        r?.length > 0
      ) {
        setResult(r);
      }
      cacheListRef.current[topicType] = r;
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

  const { isVersionCompatible } = useVersionCompatible();

  const handleClearUnread = useCallback(() => {
    setUnreadMap({
      [ENotificationPushTopicTypes.accountActivity]: 0,
      [ENotificationPushTopicTypes.system]: 0,
    });
  }, [setUnreadMap]);

  const renderHeaderRight = useCallback(
    () => (
      <HeaderRight
        onClearUnread={handleClearUnread}
        closePopover={closePopover}
      />
    ),
    [handleClearUnread, closePopover],
  );

  useEffect(() => {
    const fn = async () => {
      const r = await reFetchList();
      setResult(r ?? []);
    };
    appEventBus.on(EAppEventBusNames.UpdateNotificationBadge, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.UpdateNotificationBadge, fn);
    };
  }, [reFetchList]);

  const contentView = useMemo(() => {
    return (
      <SectionList
        useFlashList
        ref={listRef}
        contentContainerStyle={{
          pb: bottom || '$5',
        }}
        sections={sectionsData}
        renderSectionHeader={
          (_) => null // <SectionList.SectionHeader title={title} />
        }
        renderItem={({
          item,
          index,
        }: {
          item: INotificationPushMessageListItem;
          index: number;
        }) => {
          const itemView = (
            <YStack>
              {index > 0 ? (
                <XStack pl={60} pr="$3" py="$0.5">
                  <Divider borderColor="$neutral3" />
                </XStack>
              ) : null}
              <NotificationItemMemo
                key={item.msgId || index}
                item={item}
                onPress={async () => {
                  if (
                    isVersionCompatible(item.body.extras?.miniBundlerVersion)
                  ) {
                    await closePopover?.();
                    void notificationsUtils.navigateToNotificationDetail({
                      topicType: item.topicType,
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
                      isRead: !!item.readed,
                    });
                    setTimeout(() => {
                      if (!item.readed) {
                        setUnreadMap((prev) => ({
                          ...prev,
                          [item.topicType]: Math.max(
                            0,
                            (prev[item.topicType] ?? 0) - 1,
                          ),
                        }));
                      }
                    }, 100);
                  }
                }}
              />
            </YStack>
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
  }, [
    bottom,
    closePopover,
    intl,
    isLoading,
    isVersionCompatible,
    navigation,
    sectionsData,
  ]);

  const handleTabPress = useCallback(
    (tabName: string) => {
      const tab = tabs.find((i) => i.name === tabName);
      if (tab) {
        focusedTab.value = tab.name;
        void reFetchList();
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index: 0,
            animated: false,
          });
        }, 10);
      }
    },
    [focusedTab, reFetchList, tabs],
  );

  const handleRenderItem = useCallback(
    (props: ITabBarItemProps) => {
      const tabId = tabs.find((i) => i.name === props.name)?.id;
      let unreadCount = 0;
      if (tabId === ENotificationPushTopicTypes.all) {
        unreadCount = tabs.reduce((acc, tab) => {
          return acc + (unreadMap[tab.id as keyof typeof unreadMap] || 0);
        }, 0);
      } else {
        unreadCount = unreadMap[tabId as keyof typeof unreadMap];
      }
      return (
        <XStack position="relative">
          <TabBarItem {...props} />
          {unreadCount > 0 ? (
            <Stack
              position="absolute"
              right={-6}
              top={12}
              w="$1.5"
              h="$1.5"
              bg="$iconCritical"
              borderRadius="$full"
            />
          ) : null}
        </XStack>
      );
    },
    [unreadMap, tabs],
  );

  return (
    <YStack flex={1} {...containerStyle}>
      {showPageHeader ? (
        <Page.Header
          title={intl.formatMessage({ id: ETranslations.global_notifications })}
          headerRight={renderHeaderRight}
        />
      ) : (
        <YStack
          zIndex={10}
          bg="$bg"
          $platform-web={{
            position: 'sticky',
            top: 0,
          }}
        >
          <XStack alignItems="center" px="$5" gap="$2" pt="$4" pb="$2">
            <SizableText size="$headingXl" color="$text" userSelect="none">
              {intl.formatMessage({ id: ETranslations.global_notifications })}
            </SizableText>
            <HeaderRight
              style={{ flex: 1, justifyContent: 'flex-end' }}
              onClearUnread={handleClearUnread}
              closePopover={closePopover}
            />
          </XStack>
          <Tabs.TabBar
            tabNames={tabTitles}
            onTabPress={handleTabPress}
            focusedTab={focusedTab}
            renderItem={handleRenderItem}
            containerStyle={{ bg: 'transparent' }}
          />
        </YStack>
      )}
      {showPageHeader ? (
        <Tabs.TabBar
          tabNames={tabTitles}
          onTabPress={handleTabPress}
          focusedTab={focusedTab}
          renderItem={handleRenderItem}
          tabItemStyle={{
            h: 44,
          }}
        />
      ) : null}
      <YStack pt="$2" flex={1}>
        {shouldShowMaxAccountLimitWarning ? <MaxAccountLimitWarning /> : null}
        {contentView}
      </YStack>
    </YStack>
  );
}

export function NotificationListViewPopover({
  showPageHeader = true,
  containerStyle,
}: {
  showPageHeader?: boolean;
  containerStyle?: IYStackProps;
}) {
  const { open } = usePopoverContext();
  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (open && !hasOpened) {
      setHasOpened(true);
    }
  }, [open, hasOpened]);

  if (!hasOpened) {
    return null;
  }
  return (
    <NotificationListView
      showPageHeader={showPageHeader}
      containerStyle={containerStyle}
    />
  );
}
