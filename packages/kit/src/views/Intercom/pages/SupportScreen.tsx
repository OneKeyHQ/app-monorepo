import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { AppState, FlatList, View } from 'react-native';

import {
  Button,
  Empty,
  Icon,
  IconButton,
  Image,
  LinearGradient,
  Page,
  SizableText,
  Spinner,
  TextArea,
  XStack,
  YStack,
  useSafeAreaInsets,
  useTheme,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useIntercomUnreadCount } from '@onekeyhq/kit/src/hooks/useIntercomUnreadCount';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { createIntercomMessengerSession } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import {
  intercomMessageBlocks,
  parseIntercomConversation,
  parseIntercomHome,
  parseIntercomInbox,
  parseIntercomOpen,
  parseIntercomPart,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerModels';
import type {
  IIntercomBlock,
  IIntercomConversation,
  IIntercomInbox,
  IIntercomMessengerSession,
  IIntercomPart,
  IIntercomSupportRoute,
  IIntercomImage as IPickedImage,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import { uploadIntercomImage } from '@onekeyhq/shared/src/modules3rdParty/intercom/upload';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';
import type { IIntercomParamList } from '@onekeyhq/shared/src/routes/intercom';
import { formatRelativeDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { ConversationRow } from '../components/ConversationRow';
import { MessagePart } from '../components/MessagePart';
import { SupportAvatars } from '../components/SupportAvatar';
import { SupportHelp } from '../components/SupportHelp';
import { SupportHomeHeader } from '../components/SupportHomeHeader';
import { SupportNavigation } from '../components/SupportNavigation';
import { useSupportAutoScroll } from '../hooks/useSupportAutoScroll';
import { useSupportResource } from '../hooks/useSupportResource';
import { cleanSupportImage, pickSupportImage } from '../utils/pickSupportImage';

import type { RouteProp } from '@react-navigation/native';

function SupportError({ retry }: { retry: () => void }) {
  const intl = useIntl();
  return (
    <Empty
      title={intl.formatMessage({
        id: ETranslations.global_connet_error_try_again,
      })}
      buttonProps={{
        testID: 'support-retry',
        children: intl.formatMessage({ id: ETranslations.global_retry }),
        onPress: retry,
      }}
    />
  );
}

function SupportInbox({
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
  const load = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    return parseIntercomInbox(
      await session.request('conversations', { per_page: 20 }),
    );
  }, [session]);
  const inbox = useSupportResource(load, active, true);
  const loadOpen = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    return parseIntercomOpen(await session.request('new_conversation_content'));
  }, [session]);
  const open = useSupportResource(loadOpen, active);
  const loadHome = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    return parseIntercomHome(await session.request('home'));
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
      const next = parseIntercomInbox(
        await session.request('conversations', {
          per_page: 20,
          ...(page.nextPage !== undefined
            ? { page: page.nextPage }
            : { before: page.before }),
        }),
      );
      if (revision === moreRevision.current)
        setOlder({
          ...next,
          conversations: [
            ...(older?.conversations ?? []),
            ...next.conversations,
          ],
        });
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
    return Array.from(values.values());
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
  const recentLimit = homeContent.data?.recentConversationLimit ?? 0;
  const header = (
    <YStack>
      {home ? (
        <SupportHomeHeader
          appearance={appearance}
          avatars={open.data?.header.avatars}
          onClose={navigation.popStack}
        />
      ) : (
        <XStack
          px="$5"
          py="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <SizableText size="$headingXl">
            {homeContent.data?.messagesLabel}
          </SizableText>
          <IconButton
            testID="support-refresh"
            variant="tertiary"
            icon="RefreshCcwOutline"
            onPress={refresh}
            accessibilityLabel={intl.formatMessage({
              id: ETranslations.global_refresh,
            })}
          />
        </XStack>
      )}
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
            opacity={open.data?.canCreateConversation ? 1 : 0.5}
          >
            <YStack flex={1} gap="$1">
              <SizableText size="$bodyLgMedium">
                {newConversationLabel}
              </SizableText>
            </YStack>
            {open.loading && !open.data ? (
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
              {homeContent.data?.articles.map((article) => (
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
          ? homeContent.data?.links.map((link) => (
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
          <Page.Header title="" headerShown={!home} />
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
                {inbox.loading && !inbox.data ? <Spinner /> : null}
                {!home && !inbox.loading && !inbox.failed ? (
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
                  <Button
                    testID="support-new-conversation"
                    icon="SendOutline"
                    variant="primary"
                    borderRadius={12}
                    loading={open.loading && !open.data}
                    disabled={!open.data?.canCreateConversation}
                    onPress={startConversation}
                  >
                    {newConversationLabel}
                  </Button>
                </YStack>
              ) : null}
              <SupportNavigation
                home={home}
                unread={unread}
                onHome={() => {
                  if (!home) navigation.pop();
                }}
                onMessages={showMessages}
                homeLabel={homeContent.data?.homeLabel}
                messagesLabel={homeContent.data?.messagesLabel}
              />
            </YStack>
          </Page.Footer>
        </YStack>
      </Page.Body>
    </Page>
  );
}

type IOutgoing = {
  id: string;
  createdAt?: number;
  text: string;
  image?: IPickedImage;
  blocks?: IIntercomBlock[];
  quickReply?: { partId: string; replyId: string };
  status: 'sending' | 'failed';
};

function SupportConversation({
  session,
  active,
  route,
  sessionError,
}: {
  session?: IIntercomMessengerSession;
  active: boolean;
  route: IIntercomSupportRoute;
  sessionError?: () => void;
}) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IModalNavigationProp<IIntercomParamList>>();
  const [conversationId, setConversationId] = useState(route.conversationId);
  const load = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    if (conversationId) {
      const conversation = parseIntercomConversation(
        await session.request(
          `conversations/${encodeURIComponent(conversationId)}`,
          { request_origin: 'State Sync' },
        ),
      );
      return { conversation, open: undefined };
    }
    return {
      conversation: undefined,
      open: parseIntercomOpen(
        await session.request('new_conversation_content'),
      ),
    };
  }, [session, conversationId]);
  const resource = useSupportResource(load, active, !!conversationId);
  const refreshConversation = resource.refresh;
  const [draft, setDraft] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [image, setImage] = useState<IPickedImage>();
  const [pending, setPending] = useState<IOutgoing>();
  const [confirmed, setConfirmed] = useState<IIntercomPart[]>([]);
  const [actionFailed, setActionFailed] = useState(false);
  const sending = useRef(false);
  const alive = useRef(true);
  const pickedFiles = useRef(new Set<string>());
  const uploadController = useRef<AbortController | undefined>(undefined);
  const list = useRef<FlatList<IIntercomPart>>(null);
  const { scrollProps, followLatest } = useSupportAutoScroll(list, active);
  useEffect(() => {
    alive.current = true;
    const files = pickedFiles.current;
    return () => {
      alive.current = false;
      uploadController.current?.abort();
      for (const path of files)
        void cleanSupportImage(path).catch(() => undefined);
    };
  }, []);
  const current = resource.data?.conversation;
  const open = resource.data?.open;
  const lastReceiptData = useRef<IIntercomConversation | undefined>(undefined);
  useEffect(() => {
    if (current === lastReceiptData.current) return;
    lastReceiptData.current = current;
    if (active && current && !current.read && current.id === conversationId)
      // Mark only a conversation committed to the active screen as read.
      void session
        ?.request(`conversations/${encodeURIComponent(current.id)}/read`)
        .catch(() => undefined);
  }, [active, conversationId, current, session]);
  const parts = useMemo(() => {
    const all = new Map<string, IIntercomPart>();
    for (const part of [
      ...(current?.parts ?? open?.initialParts ?? []),
      ...confirmed,
    ]) {
      if (!all.has(part.id)) all.set(part.id, part);
    }
    return Array.from(all.values()).toSorted(
      (a, b) => a.createdAt - b.createdAt,
    );
  }, [current, open, confirmed]);
  const canReply =
    active && (current?.canReply ?? open?.canWriteMessage ?? false);
  const header = current?.header ?? open?.header;
  const renderHeaderTitle = useCallback(
    () => (
      <XStack gap="$2.5" alignItems="center" maxWidth={240}>
        {header?.avatars.length ? (
          <SupportAvatars avatars={header.avatars} size={28} />
        ) : null}
        <YStack flexShrink={1}>
          <SizableText size="$headingMd" numberOfLines={1}>
            {header?.title || 'OneKey'}
          </SizableText>
          {header?.subtitle ? (
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {header.subtitle}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    ),
    [header],
  );
  const send = useCallback(
    async (outgoing: IOutgoing) => {
      if (!session || sending.current || !active) return;
      sending.current = true;
      setPending({ ...outgoing, status: 'sending' });
      followLatest();
      let prepared: IOutgoing = {
        ...outgoing,
        createdAt: outgoing.createdAt ?? Math.floor(Date.now() / 1000),
      };
      try {
        await session.assertCurrent();
        if (!alive.current) return;
        let blocks =
          prepared.blocks ??
          (prepared.text.trim() ? intercomMessageBlocks(prepared.text) : []);
        if (prepared.image && !prepared.blocks) {
          const controller = new AbortController();
          uploadController.current = controller;
          blocks = [
            ...blocks,
            await uploadIntercomImage(
              session,
              prepared.image,
              controller.signal,
            ),
          ];
        }
        prepared = { ...prepared, blocks };
        if (!alive.current) return;
        const payload = {
          client_assigned_uuid: prepared.id,
          created_at: prepared.createdAt,
          blocks,
        };
        if (conversationId) {
          const path = `conversations/${encodeURIComponent(conversationId)}`;
          const response = prepared.quickReply
            ? await session.request(`${path}/quick_reply`, {
                client_assigned_uuid: prepared.id,
                conversation_part: {
                  id: prepared.quickReply.partId.startsWith('message-')
                    ? null
                    : prepared.quickReply.partId,
                  reply_option: {
                    uuid: prepared.quickReply.replyId,
                    text: prepared.text,
                    type: 'quick_reply',
                  },
                },
              })
            : await session.request(`${path}/reply`, payload);
          const part = parseIntercomPart(response);
          if (!part.id) throw new OneKeyLocalError('Invalid support reply');
          if (alive.current) setConfirmed((previous) => [...previous, part]);
        } else {
          if (!open?.canCreateConversation)
            throw new OneKeyLocalError('Support composer is unavailable');
          const conversation = parseIntercomConversation(
            prepared.quickReply
              ? await session.request(
                  'custom_bots/trigger_inbound_conversation',
                  {
                    id: prepared.quickReply.replyId,
                    client_assigned_uuid: prepared.id,
                    messenger_open_request_id:
                      open.createParams.messenger_open_request_id,
                  },
                )
              : await session.request('messages', {
                  ...open.createParams,
                  ...payload,
                }),
          );
          if (alive.current) {
            setConfirmed(conversation.parts);
            setConversationId(conversation.id);
            navigation.setParams({ conversationId: conversation.id });
          }
        }
        if (alive.current) {
          setPending(undefined);
          // A refresh failure must not turn an acknowledged send into a retry.
          void refreshConversation();
        }
      } catch {
        if (alive.current) setPending({ ...prepared, status: 'failed' });
      } finally {
        sending.current = false;
      }
    },
    [
      active,
      session,
      conversationId,
      open,
      navigation,
      refreshConversation,
      followLatest,
    ],
  );
  const pickImage = useCallback(async () => {
    try {
      const selected = await pickSupportImage();
      if (!selected) return;
      if (!alive.current) {
        await cleanSupportImage(selected.path);
        return;
      }
      pickedFiles.current.add(selected.path);
      if (selected.size > 20 * 1024 * 1024)
        throw new OneKeyLocalError('Image is too large');
      setImage(selected);
      setActionFailed(false);
    } catch {
      if (alive.current) setActionFailed(true);
    }
  }, []);
  const sendDraft = useCallback(() => {
    if ((!draft.trim() && !image) || !canReply || pending || sending.current)
      return;
    const outgoing: IOutgoing = {
      id: generateUUID(),
      text: draft,
      image,
      status: 'sending',
    };
    setDraft('');
    setImage(undefined);
    void send(outgoing);
  }, [draft, image, canReply, pending, send]);
  const footer = (
    <YStack gap="$3" py="$3">
      {!conversationId && open?.suggestionPrompt ? (
        <SizableText size="$bodyLg">{open.suggestionPrompt}</SizableText>
      ) : null}
      {!conversationId && open?.canCreateConversation ? (
        <XStack flexWrap="wrap" gap="$2">
          {open.suggestions.map((suggestion) => (
            <Button
              key={suggestion.id}
              testID={`support-suggestion-${suggestion.id}`}
              disabled={!active || !!pending}
              onPress={() => {
                void send({
                  id: generateUUID(),
                  text: suggestion.text,
                  quickReply: { partId: '', replyId: suggestion.id },
                  status: 'sending',
                });
              }}
            >
              {suggestion.text}
            </Button>
          ))}
        </XStack>
      ) : null}
      {resource.failed ? (
        <SupportError
          retry={() => {
            void refreshConversation();
          }}
        />
      ) : null}
      {sessionError ? <SupportError retry={sessionError} /> : null}
      {pending ? (
        <YStack
          alignSelf="flex-end"
          maxWidth="90%"
          gap="$2"
          testID="support-pending-message"
        >
          <YStack bg="$bgInverse" px="$4" py="$3" borderRadius={20} gap="$2">
            {pending.text ? (
              <SizableText selectable size="$bodyLg" color="$textInverse">
                {pending.text}
              </SizableText>
            ) : null}
            {pending.image ? (
              <Image
                source={{ uri: pending.image.path }}
                width={160}
                height={120}
                resizeMode="contain"
              />
            ) : null}
          </YStack>
          {pending.status === 'sending' ? (
            <Spinner />
          ) : (
            <XStack gap="$2">
              <Button
                testID="support-retry-send"
                size="small"
                onPress={() => {
                  void send(pending);
                }}
              >
                {intl.formatMessage({ id: ETranslations.global_retry })}
              </Button>
              <Button
                testID="support-discard-send"
                size="small"
                variant="tertiary"
                onPress={() => {
                  setDraft(pending.text);
                  setImage(pending.image);
                  setPending(undefined);
                }}
              >
                {intl.formatMessage({ id: ETranslations.global_cancel })}
              </Button>
            </XStack>
          )}
        </YStack>
      ) : null}
    </YStack>
  );
  return (
    <Page>
      <Page.Body>
        <YStack flex={1} bg="$bgApp">
          <Page.Header headerTitle={renderHeaderTitle} />
          <FlatList
            testID="support-chat-messages"
            ref={list}
            data={parts}
            ListHeaderComponent={
              !conversationId && (open?.welcome || open?.notice) ? (
                <YStack gap="$2" pb="$4">
                  {open.welcome ? (
                    <SizableText color="$textSubdued">
                      {open.welcome}
                    </SizableText>
                  ) : null}
                  {open.notice ? (
                    <SizableText color="$textSubdued">
                      {open.notice}
                    </SizableText>
                  ) : null}
                </YStack>
              ) : undefined
            }
            keyExtractor={(part) => part.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 24,
              paddingBottom: 8,
            }}
            keyboardShouldPersistTaps="handled"
            {...scrollProps}
            ListEmptyComponent={
              resource.loading ? (
                <View>
                  <Spinner />
                </View>
              ) : undefined
            }
            ListFooterComponent={footer}
            renderItem={({ item, index }) => {
              const previous = parts[index - 1];
              const next = parts[index + 1];
              const isSameGroup = (other?: IIntercomPart) =>
                !!other &&
                other.author === item.author &&
                other.isAdmin === item.isAdmin &&
                Math.abs(other.createdAt - item.createdAt) < 120;
              const date = new Date(item.createdAt * 1000);
              const showDate =
                item.createdAt &&
                (!previous ||
                  new Date(previous.createdAt * 1000).toDateString() !==
                    date.toDateString());
              return (
                <YStack>
                  {showDate ? (
                    <SizableText
                      textAlign="center"
                      size="$bodySm"
                      color="$textSubdued"
                      pb="$5"
                    >
                      {formatRelativeDate(date)}
                    </SizableText>
                  ) : null}
                  <MessagePart
                    part={item}
                    firstInGroup={!isSameGroup(previous)}
                    lastInGroup={!isSameGroup(next)}
                    disabled={!!pending || !active}
                    onFormSubmit={async (partId, identifier, value) => {
                      if (!session || !conversationId) return;
                      await session.request(
                        `conversations/${encodeURIComponent(conversationId)}/form`,
                        {
                          form_params: {
                            conversation_part_id: partId,
                            identifier,
                            value,
                          },
                        },
                      );
                      await refreshConversation();
                    }}
                    onQuickReply={
                      conversationId && index === parts.length - 1
                        ? (partId, replyId, text) => {
                            void send({
                              id: generateUUID(),
                              text,
                              quickReply: { partId, replyId },
                              status: 'sending',
                            });
                          }
                        : undefined
                    }
                  />
                </YStack>
              );
            }}
          />
          <Page.Footer>
            <YStack px="$3" pb="$3" pt="$2" bg="$bgApp">
              {actionFailed ? (
                <SizableText px="$5" color="$textCritical">
                  {intl.formatMessage({
                    id: ETranslations.global_unknown_error_retry_message,
                  })}
                </SizableText>
              ) : null}
              <YStack
                testID="support-composer"
                borderWidth={1.5}
                borderColor={
                  composerFocused ? '$borderActive' : '$borderStrong'
                }
                borderRadius={20}
                bg="$bgApp"
                overflow="hidden"
              >
                {image ? (
                  <XStack px="$3" pt="$3" gap="$3" alignItems="center">
                    <Image
                      source={{ uri: image.path }}
                      width={64}
                      height={64}
                      resizeMode="contain"
                    />
                    <IconButton
                      testID="support-remove-image"
                      icon="CrossedLargeOutline"
                      accessibilityLabel={intl.formatMessage({
                        id: ETranslations.global_cancel,
                      })}
                      onPress={() => setImage(undefined)}
                    />
                  </XStack>
                ) : null}
                <TextArea
                  testID="support-message-input"
                  accessibilityLabel={intl.formatMessage({
                    id: ETranslations.global_contact_us,
                  })}
                  minHeight={64}
                  maxHeight={140}
                  numberOfLines={2}
                  borderWidth={0}
                  borderRadius={0}
                  bg="transparent"
                  px="$5"
                  pt="$4"
                  pb="$2"
                  focusStyle={{ outlineWidth: 0 }}
                  maxLength={10_000}
                  value={draft}
                  onChangeText={setDraft}
                  onFocus={() => setComposerFocused(true)}
                  onBlur={() => setComposerFocused(false)}
                  editable={canReply && !pending}
                  placeholder={
                    current?.placeholder || open?.composerPlaceholder
                  }
                />
                <XStack
                  px="$2"
                  pb="$2"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <IconButton
                    testID="support-add-image"
                    variant="tertiary"
                    icon="ImageMountainsOutline"
                    accessibilityLabel={intl.formatMessage({
                      id: ETranslations.global_add,
                    })}
                    disabled={!canReply || !!pending}
                    onPress={() => {
                      void pickImage();
                    }}
                  />
                  <IconButton
                    testID="support-send"
                    icon="ArrowTopOutline"
                    accessibilityLabel={intl.formatMessage({
                      id: ETranslations.global_send,
                    })}
                    variant="primary"
                    borderRadius={18}
                    width={36}
                    height={36}
                    mr="$0.5"
                    disabled={
                      !canReply || !!pending || (!draft.trim() && !image)
                    }
                    onPress={sendDraft}
                  />
                </XStack>
              </YStack>
            </YStack>
          </Page.Footer>
        </YStack>
      </Page.Body>
    </Page>
  );
}

function SupportContent({
  route,
  mode,
}: {
  route: IIntercomSupportRoute;
  mode: EIntercomRoutes;
}) {
  const focused = useRouteIsFocused();
  const [foreground, setForeground] = useState(
    !platformEnv.isNative || AppState.currentState === 'active',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  const createSession = useCallback(
    () =>
      createIntercomMessengerSession(route.userId || null, {
        requestId: route.requestId,
      }),
    [route.userId, route.requestId],
  );
  const session = useSupportResource(createSession, true);
  const retrySession = () => {
    void session.refresh();
  };
  const sharedProps = {
    session: session.data,
    active: focused && foreground && !!session.data,
    sessionError: session.failed ? retrySession : undefined,
    route,
  };
  if (mode === EIntercomRoutes.Conversation)
    return (
      <SupportConversation
        key={route.conversationId ?? 'new'}
        {...sharedProps}
      />
    );
  if (mode === EIntercomRoutes.Help) return <SupportHelp {...sharedProps} />;
  return <SupportInbox {...sharedProps} home={mode === EIntercomRoutes.Home} />;
}

export default function SupportScreen() {
  const route = useRoute<RouteProp<IIntercomParamList, EIntercomRoutes>>();
  const navigation =
    useAppNavigation<IModalNavigationProp<IIntercomParamList>>();
  const [{ isLoggedIn, onekeyUserId }] = usePrimePersistAtom();
  const [locked] = useAppIsLockedAtom();
  const sameUser =
    (isLoggedIn ? onekeyUserId : null) === (route.params.userId || null);
  if (!sameUser || locked)
    return (
      <Page
        shouldRedirect={() => !sameUser}
        onRedirected={() => navigation.popStack()}
      />
    );
  return (
    <SupportContent
      key={`${route.key}-${route.params.userId ?? 'anonymous'}`}
      route={route.params}
      mode={route.name}
    />
  );
}
