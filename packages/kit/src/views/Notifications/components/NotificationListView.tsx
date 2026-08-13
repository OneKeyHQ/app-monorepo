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
  glassBarItem,
  usePopoverContext,
  useSafeAreaInsets,
} from '@onekeyhq/components';
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
import { NotificationsTestIDs } from '../testIDs';

import {
  ENotificationListTab,
  type INotificationListTab,
  applyNotificationReadState,
  getNotificationListTopicTypes,
  isNotificationListResponseCurrent,
  markNotificationItemRead,
  markNotificationItemsRead,
} from './notificationListUtils';

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
  style,
  markAllReadTitle,
  onMarkAllReadPress,
  onSettingsButtonPress,
}: {
  style?: IXStackProps;
  markAllReadTitle: string;
  onMarkAllReadPress: () => Promise<void>;
  onSettingsButtonPress: () => Promise<void>;
}) {
  return (
    <HeaderButtonGroup {...style}>
      <HeaderIconButton
        testID={NotificationsTestIDs.markAllReadBtn}
        icon="BroomOutline"
        title={markAllReadTitle}
        onPress={onMarkAllReadPress}
      />
      {canShowNotificationSettings ? (
        <HeaderIconButton
          testID={NotificationsTestIDs.settingsBtn}
          icon="SettingsOutline"
          onPress={onSettingsButtonPress}
        />
      ) : null}
    </HeaderButtonGroup>
  );
}

function useNotificationHeaderActions({
  onMarkAllReadSuccess,
  closePopover,
}: {
  onMarkAllReadSuccess: () => void;
  closePopover?: () => Promise<void>;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const markAllReadTitle = intl.formatMessage({
    id: ETranslations.global_mark_all_as_confirmation_title_tooltip,
  });

  const handleSettingsButtonPress = useCallback(async () => {
    await closePopover?.();
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingNotifications,
    });
  }, [closePopover, navigation]);

  const handleMarkAllReadPress = useCallback(async () => {
    await backgroundApiProxy.serviceNotification.markNotificationReadAll();
    onMarkAllReadSuccess();
  }, [onMarkAllReadSuccess]);

  return {
    markAllReadTitle,
    handleMarkAllReadPress,
    handleSettingsButtonPress,
  };
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
          w={26}
          h={26}
          bg="$bgSubdued"
          borderRadius="$full"
          ai="center"
          jc="center"
        >
          <Icon name={item.icon} color="$iconStrong" size="$4.5" />
        </Stack>
      );
    }
    // Only render the left image for non-system topics to avoid duplicates
    if (
      extras?.image &&
      item.topicType !== ENotificationPushTopicTypes.system
    ) {
      return (
        <Image size={24} source={{ uri: extras.image }} borderRadius="$2" />
      );
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
        <YStack flex={1} gap="$1">
          <SizableText size="$bodyMdMedium" color="$text" numberOfLines={2}>
            {title}
          </SizableText>

          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={3}>
            {content}
          </SizableText>
          <SizableText size="$bodySm" color="$textDisabled" flexShrink={0}>
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
            borderRadius="$2"
          />
        ) : null}
      </XStack>
    </ListItem>
  );
}

const NotificationItemMemo = memo(NotificationItem);

function buildReadedMessageMap(
  notifications: INotificationPushMessageListItem[],
) {
  return notifications.reduce<Record<string, boolean>>((acc, item) => {
    if (item.msgId) {
      acc[item.msgId] = true;
    }
    return acc;
  }, {});
}

function createNotificationListCache(): Record<
  INotificationListTab,
  INotificationPushMessageListItem[]
> {
  return {
    [ENotificationListTab.all]: [],
    [ENotificationListTab.accountActivity]: [],
    [ENotificationListTab.alertsAndUpdates]: [],
  };
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
  useFlashList = true,
}: {
  showPageHeader?: boolean;
  containerStyle?: IYStackProps;
  useFlashList?: boolean;
}) {
  const { closePopover } = usePopoverContext();
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const [{ lastReceivedTime, firstTimeGuideOpened }, setNotificationsData] =
    useNotificationsAtom();
  const [readedMap, setReadedMap] = useNotificationsReadedAtom();
  const readedMapRef = useRef(readedMap);
  readedMapRef.current = readedMap;

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

  const tabs = useMemo<
    {
      id: INotificationListTab;
      name: string;
    }[]
  >(
    () => [
      {
        id: ENotificationListTab.all,
        name: intl.formatMessage({ id: ETranslations.global_all }),
      },
      {
        id: ENotificationListTab.accountActivity,
        name: intl.formatMessage({
          id: ETranslations.notifications_notifications_account_activity_label,
        }),
      },
      {
        id: ENotificationListTab.alertsAndUpdates,
        name: intl.formatMessage({
          id: ETranslations.alerts_and_updates__action,
        }),
      },
    ],

    [intl],
  );

  const tabTitles = useMemo(() => {
    return tabs.map((tab) => tab.name);
  }, [tabs]);
  const focusedTab = useSharedValue<string>(tabs[0].name);
  const [activeTabId, setActiveTabId] = useState<INotificationListTab>(
    ENotificationListTab.all,
  );
  const activeTabIdRef = useRef<INotificationListTab>(activeTabId);
  activeTabIdRef.current = activeTabId;
  const [
    shouldShowMaxAccountLimitWarning,
    setShouldShowMaxAccountLimitWarning,
  ] = useState(false);

  const [result, setResult] = useState<INotificationPushMessageListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const cacheListRef = useRef(createNotificationListCache());
  const latestRequestIdRef = useRef(0);
  const messageListMutationVersionRef = useRef(0);
  const fetchNotificationList = useCallback(
    async (tabId: INotificationListTab) => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      const requestMutationVersion = messageListMutationVersionRef.current;

      const cachedList = cacheListRef.current[tabId];

      if (activeTabIdRef.current === tabId) {
        setShouldShowMaxAccountLimitWarning(
          tabId === ENotificationListTab.all ||
            tabId === ENotificationListTab.accountActivity,
        );
        setResult(cachedList);
        setIsLoading(true);
      }

      void backgroundApiProxy.serviceNotification.refreshBadgeFromServer();
      try {
        const fetchedList =
          await backgroundApiProxy.serviceNotification.fetchMessageList(
            getNotificationListTopicTypes(tabId),
          );
        if (
          !isNotificationListResponseCurrent({
            requestId,
            latestRequestId: latestRequestIdRef.current,
            requestMutationVersion,
            currentMutationVersion: messageListMutationVersionRef.current,
            requestTabId: tabId,
            activeTabId: activeTabIdRef.current,
          })
        ) {
          return;
        }

        const nextList = applyNotificationReadState(
          fetchedList,
          readedMapRef.current,
        );
        cacheListRef.current[tabId] = nextList;
        setResult(nextList);
      } catch {
        if (
          requestId === latestRequestIdRef.current &&
          tabId === activeTabIdRef.current
        ) {
          setResult(cacheListRef.current[tabId]);
        }
      } finally {
        if (
          requestId === latestRequestIdRef.current &&
          tabId === activeTabIdRef.current
        ) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    noop(lastReceivedTime);
    void fetchNotificationList(activeTabId);
  }, [activeTabId, fetchNotificationList, lastReceivedTime]);

  useEffect(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);
    if (activeTab) {
      focusedTab.value = activeTab.name;
    }
  }, [activeTabId, focusedTab, tabs]);

  const sectionsData = useMemo(
    () => groupNotificationsByDate(result),
    [result],
  );

  const { isVersionCompatible } = useVersionCompatible();

  const handleMarkAllReadSuccess = useCallback(() => {
    messageListMutationVersionRef.current += 1;
    const allCachedItems = Object.values(cacheListRef.current).flat();
    const readedMessageMap = buildReadedMessageMap(allCachedItems);
    cacheListRef.current = {
      [ENotificationListTab.all]: markNotificationItemsRead(
        cacheListRef.current[ENotificationListTab.all],
      ),
      [ENotificationListTab.accountActivity]: markNotificationItemsRead(
        cacheListRef.current[ENotificationListTab.accountActivity],
      ),
      [ENotificationListTab.alertsAndUpdates]: markNotificationItemsRead(
        cacheListRef.current[ENotificationListTab.alertsAndUpdates],
      ),
    };
    setResult((prev) => markNotificationItemsRead(prev));
    setReadedMap((prev) => ({
      ...prev,
      ...readedMessageMap,
    }));
    setNotificationsData((v) => ({
      ...v,
      badge: 0,
    }));
    void fetchNotificationList(activeTabIdRef.current);
  }, [fetchNotificationList, setNotificationsData, setReadedMap]);

  const handleNotificationItemRead = useCallback(
    (item: INotificationPushMessageListItem) => {
      if (item.readed || readedMapRef.current[item.msgId]) {
        return;
      }
      messageListMutationVersionRef.current += 1;
      cacheListRef.current = {
        [ENotificationListTab.all]: markNotificationItemRead(
          cacheListRef.current[ENotificationListTab.all],
          item.msgId,
        ),
        [ENotificationListTab.accountActivity]: markNotificationItemRead(
          cacheListRef.current[ENotificationListTab.accountActivity],
          item.msgId,
        ),
        [ENotificationListTab.alertsAndUpdates]: markNotificationItemRead(
          cacheListRef.current[ENotificationListTab.alertsAndUpdates],
          item.msgId,
        ),
      };
      setResult((prev) => markNotificationItemRead(prev, item.msgId));
      setReadedMap((prev) => ({
        ...prev,
        [item.msgId]: true,
      }));
    },
    [setReadedMap],
  );

  const {
    markAllReadTitle,
    handleMarkAllReadPress,
    handleSettingsButtonPress,
  } = useNotificationHeaderActions({
    onMarkAllReadSuccess: handleMarkAllReadSuccess,
    closePopover,
  });

  const renderHeaderRight = useCallback(
    () => (
      <HeaderRight
        markAllReadTitle={markAllReadTitle}
        onMarkAllReadPress={handleMarkAllReadPress}
        onSettingsButtonPress={handleSettingsButtonPress}
      />
    ),
    [handleMarkAllReadPress, handleSettingsButtonPress, markAllReadTitle],
  );

  const buildNativeHeaderRightItems = useCallback(
    () => [
      glassBarItem(
        <HeaderIconButton
          testID={NotificationsTestIDs.markAllReadBtn}
          icon="BroomOutline"
          title={markAllReadTitle}
          onPress={handleMarkAllReadPress}
        />,
      ),
      ...(canShowNotificationSettings
        ? [
            glassBarItem(
              <HeaderIconButton
                testID={NotificationsTestIDs.settingsBtn}
                icon="SettingsOutline"
                onPress={handleSettingsButtonPress}
              />,
            ),
          ]
        : []),
    ],
    [handleMarkAllReadPress, handleSettingsButtonPress, markAllReadTitle],
  );

  useEffect(() => {
    const fn = () => {
      void fetchNotificationList(activeTabIdRef.current);
    };
    appEventBus.on(EAppEventBusNames.UpdateNotificationBadge, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.UpdateNotificationBadge, fn);
    };
  }, [fetchNotificationList]);

  const contentView = useMemo(() => {
    return (
      <SectionList
        useFlashList={useFlashList}
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
                testID={`${NotificationsTestIDs.notificationItem}-${index}`}
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
                      handleNotificationItemRead(item);
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
              pt={112}
              illustration="Notification"
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
    handleNotificationItemRead,
    intl,
    isLoading,
    isVersionCompatible,
    navigation,
    sectionsData,
    useFlashList,
  ]);

  const handleTabPress = useCallback(
    (tabName: string) => {
      const tab = tabs.find((i) => i.name === tabName);
      if (tab) {
        activeTabIdRef.current = tab.id;
        focusedTab.value = tab.name;
        setActiveTabId(tab.id);
        setShouldShowMaxAccountLimitWarning(
          tab.id === ENotificationListTab.all ||
            tab.id === ENotificationListTab.accountActivity,
        );
        setResult(cacheListRef.current[tab.id]);
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index: 0,
            animated: false,
          });
        }, 10);
      }
    },
    [focusedTab, tabs],
  );

  return (
    <YStack flex={1} {...containerStyle}>
      {showPageHeader ? (
        <Page.Header
          title={intl.formatMessage({ id: ETranslations.global_notifications })}
          {...(platformEnv.isNativeIOS26Plus
            ? { unstable_headerRightItems: buildNativeHeaderRightItems }
            : { headerRight: renderHeaderRight })}
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
              markAllReadTitle={markAllReadTitle}
              onMarkAllReadPress={handleMarkAllReadPress}
              onSettingsButtonPress={handleSettingsButtonPress}
            />
          </XStack>
          <Tabs.TabBar
            tabNames={tabTitles}
            onTabPress={handleTabPress}
            focusedTab={focusedTab}
            scrollable
            containerStyle={{ bg: 'transparent' }}
          />
        </YStack>
      )}
      {showPageHeader ? (
        <Tabs.TabBar
          tabNames={tabTitles}
          onTabPress={handleTabPress}
          focusedTab={focusedTab}
          scrollable
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
      // FlashList can retain its hidden first-layout measurements in a web popover.
      useFlashList={false}
    />
  );
}
