import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigationState } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { FlatList, View } from 'react-native';

import {
  Button,
  Empty,
  HeaderIconButton,
  Icon,
  IconButton,
  LinearGradient,
  Page,
  SizableText,
  Skeleton,
  Spinner,
  XStack,
  YStack,
  useSafeAreaInsets,
  useTheme,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIntercomUnreadCount } from '@onekeyhq/kit/src/hooks/useIntercomUnreadCount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IIntercomConversation,
  IIntercomInbox,
  IIntercomMessengerSession,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';
import type {
  IIntercomParamList,
  IIntercomSupportRoute,
} from '@onekeyhq/shared/src/routes/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import {
  ConversationRow,
  ConversationRowSkeleton,
} from '../components/ConversationRow';
import { SupportHomeHeader } from '../components/SupportHomeHeader';
import { SupportNavigation } from '../components/SupportNavigation';
import { useSupportResource } from '../hooks/useSupportResource';

import { SupportError } from './SupportError';

const ARTICLE_PLACEHOLDER_WIDTHS = ['80%', '60%', '70%', '50%'] as const;
const CONVERSATION_PLACEHOLDER_ROWS = 5;

export function SupportInbox({
  session,
  active,
  home,
  route,
  sessionError,
}: {
  session?: IIntercomMessengerSession;
  active: boolean;
  home: boolean;
  route: IIntercomSupportRoute;
  sessionError?: () => void;
}) {
  const intl = useIntl();
  const { top } = useSafeAreaInsets();
  const theme = useTheme();
  const navigation =
    useAppNavigation<IModalNavigationProp<IIntercomParamList>>();
  const unread = useIntercomUnreadCount();
  // Unread replies can open the message list as the first support screen.
  const isFirstScreen = useNavigationState((state) => state.index === 0);
  const load = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    return session.listConversations();
  }, [session]);
  const inbox = useSupportResource(load, active, true);
  const loadOpen = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    return session.getOpen();
  }, [session]);
  const open = useSupportResource(loadOpen, active);
  const loadHome = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    return session.getHome();
  }, [session]);
  const homeContent = useSupportResource(loadHome, active);
  const refreshHome = homeContent.refresh;
  const refreshInbox = inbox.refresh;
  const refreshOpen = open.refresh;
  const [older, setOlder] = useState<IIntercomInbox>();
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const moreRevision = useRef(0);
  const morePending = useRef(false);
  useEffect(() => {
    setOlder(undefined);
    setMoreFailed(false);
  }, [session]);
  useEffect(() => {
    if (!inbox.data) return;
    const firstPage = inbox.data;
    setOlder((previous) => {
      if (!previous) return previous;
      const values = new Map<string, IIntercomConversation>();
      for (const item of [
        ...firstPage.conversations,
        ...previous.conversations,
      ]) {
        if (!values.has(item.id)) values.set(item.id, item);
      }
      // Retain the loaded range when polling moves a row past page one.
      // The pagination cursor still belongs to the last explicitly loaded page.
      return { ...previous, conversations: Array.from(values.values()) };
    });
  }, [inbox.data]);
  useEffect(() => {
    setMoreLoading(false);
    return () => {
      moreRevision.current += 1;
      morePending.current = false;
    };
  }, [active, session]);
  const loadMore = useCallback(async () => {
    const page = older ?? inbox.data;
    if (!session || !active || !page?.hasMore || morePending.current) return;
    morePending.current = true;
    moreRevision.current += 1;
    const revision = moreRevision.current;
    setMoreLoading(true);
    setMoreFailed(false);
    try {
      const next = await session.listConversations(page);
      if (revision === moreRevision.current)
        setOlder((previous) => ({
          ...next,
          conversations: [
            ...(previous?.conversations ?? inbox.data?.conversations ?? []),
            ...next.conversations,
          ],
        }));
    } catch {
      if (revision === moreRevision.current) setMoreFailed(true);
    } finally {
      if (revision === moreRevision.current) {
        morePending.current = false;
        setMoreLoading(false);
      }
    }
  }, [active, older, inbox.data, session]);
  const conversations = useMemo(() => {
    const values = new Map<string, IIntercomConversation>();
    for (const item of [
      ...(inbox.data?.conversations ?? []),
      ...(older?.conversations ?? []),
    ]) {
      if (!values.has(item.id)) values.set(item.id, item);
    }
    return Array.from(values.values()).toSorted(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }, [inbox.data, older]);
  const refresh = useCallback(async () => {
    moreRevision.current += 1;
    morePending.current = false;
    setMoreLoading(false);
    setMoreFailed(false);
    setOlder(undefined);
    setRefreshing(true);
    try {
      await Promise.all([refreshInbox(), refreshOpen(), refreshHome()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshInbox, refreshOpen, refreshHome]);
  // A section shows placeholders until its first answer. Without a session it
  // has only the retry prompt to show.
  const awaiting = (resource: { settled: boolean }) =>
    !sessionError && !resource.settled;
  const inboxLoading = awaiting(inbox);
  const openLoading = awaiting(open);
  const labelsLoading = awaiting(homeContent);
  // Home stacks cards from all three responses. Holding every placeholder until
  // the last one answers swaps the page in whole instead of card by card.
  const homeLoading = home && (inboxLoading || openLoading || labelsLoading);
  const appearance = open.data?.appearance;
  const newConversationLabel =
    homeContent.data?.newConversationLabel ||
    open.data?.newConversationLabel ||
    intl.formatMessage({ id: ETranslations.global_contact_us });
  const startConversation = () =>
    navigation.push(EIntercomRoutes.Conversation, {
      ...route,
      conversationId: undefined,
    });
  const showMessages = () => {
    if (home) navigation.push(EIntercomRoutes.Messages, route);
  };
  const showHelp = () => navigation.push(EIntercomRoutes.Help, route);
  const renderRefresh = useCallback(() => {
    const label = intl.formatMessage({ id: ETranslations.global_refresh });
    return (
      <HeaderIconButton
        testID="support-refresh"
        icon="RefreshCcwOutline"
        // No tooltip `title`: the tooltip mounts on the first focus and swaps
        // the button for a new node, which drops keyboard focus.
        // The apps read `accessibilityLabel`; on web only `aria-label` reaches
        // the element.
        accessibilityLabel={label}
        aria-label={label}
        onPress={() => {
          void refresh();
        }}
      />
    );
  }, [intl, refresh]);
  const messagesLabel = homeContent.data?.messagesLabel;
  // The navigation bar is keyed by its `title`, so a title that arrives late
  // would remount the bar and take focus away from its buttons. The label is
  // rendered into a bar whose `title` never changes.
  const renderTitle = useCallback(
    () =>
      labelsLoading ? (
        <YStack testID="support-messages-title-skeleton">
          <Skeleton.HeadingLg />
        </YStack>
      ) : (
        <SizableText
          testID="support-messages-title"
          role="heading"
          aria-level={1}
          // Matches the default navigation title of each platform.
          size={platformEnv.isNativeAndroid ? '$headingXl' : '$headingLg'}
          numberOfLines={1}
        >
          {messagesLabel}
        </SizableText>
      ),
    [labelsLoading, messagesLabel],
  );
  // Cards that already answered stay behind the placeholders until then.
  const homeCards = homeLoading ? undefined : homeContent.data;
  const recentLimit = homeCards?.recentConversationLimit ?? 0;
  const header = (
    <YStack>
      {home ? (
        <SupportHomeHeader
          appearance={appearance}
          avatars={open.data?.header.avatars}
          loading={homeLoading}
          onClose={navigation.popStack}
        />
      ) : null}
      <YStack px="$5" gap="$3" pb="$4">
        {home && recentLimit && conversations.length ? (
          <YStack
            bg="$bgApp"
            borderWidth={1}
            borderColor="$borderSubdued"
            borderRadius={12}
            overflow="hidden"
            py="$2"
          >
            <XStack
              px="$4"
              pt="$2"
              pb="$1"
              alignItems="center"
              justifyContent="space-between"
            >
              <SizableText size="$headingMd">
                {intl.formatMessage({ id: ETranslations.global_recents })}
              </SizableText>
              <IconButton
                testID="support-view-history"
                variant="tertiary"
                size="small"
                icon="ChevronRightOutline"
                onPress={showMessages}
                accessibilityLabel={intl.formatMessage({
                  id: ETranslations.global_history,
                })}
              />
            </XStack>
            {conversations.slice(0, recentLimit).map((item, index) => (
              <ConversationRow
                key={item.id}
                conversation={item}
                divider={
                  index < Math.min(conversations.length, recentLimit) - 1
                }
                onPress={() =>
                  navigation.push(EIntercomRoutes.Conversation, {
                    ...route,
                    conversationId: item.id,
                  })
                }
              />
            ))}
          </YStack>
        ) : null}
        {open.failed ? (
          <SupportError
            retry={() => {
              void refreshOpen();
            }}
          />
        ) : null}
        {home && !open.failed ? (
          <XStack
            testID="support-new-conversation"
            role="button"
            // Names the card while its text is still a placeholder. The apps
            // read `accessibilityLabel`; web needs `aria-label`.
            accessibilityLabel={newConversationLabel}
            aria-label={newConversationLabel}
            accessibilityState={{ disabled: !open.data?.canCreateConversation }}
            onPress={
              open.data?.canCreateConversation ? startConversation : undefined
            }
            alignItems="center"
            px="$4"
            py="$4"
            gap="$4"
            borderWidth={1}
            borderColor="$borderSubdued"
            borderRadius={12}
            bg="$bgApp"
            boxShadow={
              platformEnv.isNative
                ? undefined
                : '0 2px 12px rgba(0, 0, 0, 0.08)'
            }
            shadowColor="$shadowColor"
            shadowOpacity={0.06}
            shadowRadius={12}
            shadowOffset={{ width: 0, height: 4 }}
            elevation={platformEnv.isNativeAndroid ? 2 : undefined}
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            opacity={homeLoading || open.data?.canCreateConversation ? 1 : 0.5}
          >
            <YStack flex={1} gap="$1">
              {homeLoading ? (
                <Skeleton.BodyLg w={140} />
              ) : (
                <SizableText size="$bodyLgMedium">
                  {newConversationLabel}
                </SizableText>
              )}
            </YStack>
            {!homeLoading && open.loading && !open.data ? (
              <Spinner />
            ) : (
              <Icon name="SendSolid" size="$5" color="$icon" flexShrink={0} />
            )}
          </XStack>
        ) : null}
        {home ? (
          <YStack
            testID="support-help-card"
            bg="$bgApp"
            borderWidth={1}
            borderColor="$borderSubdued"
            borderRadius={12}
            p="$2"
            boxShadow={
              platformEnv.isNative
                ? undefined
                : '0 2px 12px rgba(0, 0, 0, 0.08)'
            }
            shadowColor="$shadowColor"
            shadowOpacity={0.06}
            shadowRadius={12}
            shadowOffset={{ width: 0, height: 4 }}
            elevation={platformEnv.isNativeAndroid ? 2 : undefined}
          >
            <XStack
              testID="support-help-search"
              role="button"
              onPress={showHelp}
              alignItems="center"
              px="$3"
              py="$3"
              gap="$3"
              bg="$bgSubdued"
              borderRadius="$2"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
            >
              <SizableText size="$bodyLgMedium" flex={1}>
                {intl.formatMessage({ id: ETranslations.global_search })}
              </SizableText>
              <Icon name="SearchOutline" size="$5" />
            </XStack>
            <YStack pt="$2">
              {homeLoading
                ? ARTICLE_PLACEHOLDER_WIDTHS.map((width) => (
                    <YStack key={width} px="$3" py="$2.5">
                      <Skeleton.BodyLg w={width} />
                    </YStack>
                  ))
                : null}
              {homeCards?.articles.map((article) => (
                <XStack
                  key={article.id}
                  testID={`support-article-${article.id}`}
                  role="button"
                  onPress={() => openUrlExternal(article.url)}
                  alignItems="center"
                  px="$3"
                  py="$2.5"
                  gap="$3"
                  borderRadius="$2"
                  hoverStyle={{ bg: '$bgHover' }}
                  pressStyle={{ bg: '$bgActive' }}
                >
                  <SizableText size="$bodyLg" color="$textSubdued" flex={1}>
                    {article.title}
                  </SizableText>
                  <Icon
                    name="ChevronRightOutline"
                    size="$5"
                    color="$icon"
                    flexShrink={0}
                  />
                </XStack>
              ))}
            </YStack>
          </YStack>
        ) : null}
        {homeContent.failed ? <SupportError retry={refreshHome} /> : null}
        {home
          ? homeCards?.links.map((link) => (
              <XStack
                key={link.url}
                testID="support-home-external-link"
                role="button"
                onPress={() => openUrlExternal(link.url)}
                alignItems="center"
                px="$5"
                py="$4"
                gap="$3"
                bg="$bgApp"
                borderWidth={1}
                borderColor="$borderSubdued"
                borderRadius={12}
                boxShadow={
                  platformEnv.isNative
                    ? undefined
                    : '0 2px 12px rgba(0, 0, 0, 0.08)'
                }
                shadowColor="$shadowColor"
                shadowOpacity={0.06}
                shadowRadius={12}
                shadowOffset={{ width: 0, height: 4 }}
                elevation={platformEnv.isNativeAndroid ? 2 : undefined}
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
              >
                <SizableText size="$bodyLg" flex={1}>
                  {link.label}
                </SizableText>
                <Icon
                  name="OpenOutline"
                  size="$5"
                  color="$icon"
                  flexShrink={0}
                />
              </XStack>
            ))
          : null}
        {inbox.failed ? <SupportError retry={refresh} /> : null}
        {sessionError ? <SupportError retry={sessionError} /> : null}
      </YStack>
    </YStack>
  );
  return (
    <Page>
      <Page.Body>
        <YStack
          flex={1}
          bg="$bgApp"
          pt={home && platformEnv.isNativeAndroid ? top : 0}
        >
          {/* The message list titles itself in the navigation bar. */}
          <Page.Header
            title=""
            headerTitle={home ? undefined : renderTitle}
            headerRight={home ? undefined : renderRefresh}
            headerShown={!home}
          />
          {home ? (
            <LinearGradient
              pointerEvents="none"
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              colors={[theme.bgApp.val, theme.bgSubdued.val]}
            />
          ) : null}
          <FlatList
            testID="support-conversation-list"
            data={home ? [] : conversations}
            contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={header}
            refreshing={refreshing}
            onRefresh={refresh}
            ListEmptyComponent={
              <View>
                {!home && inboxLoading ? (
                  <YStack testID="support-conversation-list-skeleton">
                    {Array.from(
                      { length: CONVERSATION_PLACEHOLDER_ROWS },
                      (_, index) => (
                        <ConversationRowSkeleton
                          key={index}
                          divider={index < CONVERSATION_PLACEHOLDER_ROWS - 1}
                        />
                      ),
                    )}
                  </YStack>
                ) : null}
                {inbox.settled && inbox.loading && !inbox.data ? (
                  <Spinner />
                ) : null}
                {!home && inbox.data && !inbox.failed ? (
                  <Empty
                    icon="BubblesOutline"
                    title={intl.formatMessage({
                      id: ETranslations.global_no_data,
                    })}
                  />
                ) : null}
              </View>
            }
            renderItem={({ item, index }) => (
              <ConversationRow
                conversation={item}
                divider={index < conversations.length - 1}
                onPress={() =>
                  navigation.push(EIntercomRoutes.Conversation, {
                    ...route,
                    conversationId: item.id,
                  })
                }
              />
            )}
            ListFooterComponent={
              !home && (older ?? inbox.data)?.hasMore ? (
                <Button
                  testID="support-load-more"
                  loading={moreLoading}
                  onPress={() => {
                    void loadMore();
                  }}
                >
                  {intl.formatMessage({
                    id: moreFailed
                      ? ETranslations.global_retry
                      : ETranslations.global_view_more,
                  })}
                </Button>
              ) : undefined
            }
          />
          <Page.Footer>
            <YStack bg="$bgApp">
              {!home && !open.failed ? (
                <YStack px="$5" py="$3">
                  {openLoading ? (
                    // Starting a conversation needs only this response, so a
                    // slow home request must not keep the button back.
                    <Skeleton h={50} radius="round" />
                  ) : (
                    <Button
                      testID="support-new-conversation"
                      icon="SendOutline"
                      variant="primary"
                      size="large"
                      loading={open.loading && !open.data}
                      disabled={!open.data?.canCreateConversation}
                      onPress={startConversation}
                    >
                      {newConversationLabel}
                    </Button>
                  )}
                </YStack>
              ) : null}
              <SupportNavigation
                home={home}
                unread={unread}
                onHome={() => {
                  if (home) return;
                  if (isFirstScreen)
                    navigation.replace(EIntercomRoutes.Home, route);
                  else navigation.pop();
                }}
                onMessages={showMessages}
                homeLabel={homeContent.data?.homeLabel}
                messagesLabel={homeContent.data?.messagesLabel}
                loading={homeLoading || labelsLoading}
              />
            </YStack>
          </Page.Footer>
        </YStack>
      </Page.Body>
    </Page>
  );
}
