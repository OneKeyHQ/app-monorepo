import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { FlatList, View } from 'react-native';

import {
  Button,
  IconButton,
  Image,
  Page,
  SizableText,
  Spinner,
  TextArea,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IModalNavigationProp } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { intercomMessageBlocks } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerModels';
import type {
  IIntercomBlock,
  IIntercomConversation,
  IIntercomMessengerSession,
  IIntercomPart,
  IIntercomImage as IPickedImage,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import { uploadIntercomImage } from '@onekeyhq/shared/src/modules3rdParty/intercom/upload';
import type {
  IIntercomParamList,
  IIntercomSupportRoute,
} from '@onekeyhq/shared/src/routes/intercom';
import { formatRelativeDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { MessagePart } from '../components/MessagePart';
import { SupportAvatars } from '../components/SupportAvatar';
import { SupportError } from '../components/SupportError';
import { SupportSessionBoundary } from '../components/SupportSessionBoundary';
import { useSupportAutoScroll } from '../hooks/useSupportAutoScroll';
import { useSupportResource } from '../hooks/useSupportResource';
import { cleanSupportImage, pickSupportImage } from '../utils/pickSupportImage';

import type { ISupportSessionProps } from '../components/SupportSessionBoundary';

type IOutgoing = {
  id: string;
  createdAt?: number;
  text: string;
  image?: IPickedImage;
  blocks?: IIntercomBlock[];
  quickReply?: { partId: string; replyId: string };
  status: 'sending' | 'failed';
};

async function findCreatedConversation(
  session: IIntercomMessengerSession,
  outgoing: IOutgoing,
) {
  const inbox = await session.listConversations();
  const matches = (conversation: IIntercomConversation) =>
    conversation.parts.some((part) => part.clientId === outgoing.id);
  for (const conversation of inbox.conversations) {
    if (matches(conversation)) return conversation;
    // The inbox may contain only the latest admin reply. Fetch recent threads
    // to find the original client UUID without ever replaying the write.
    if (conversation.updatedAt >= (outgoing.createdAt ?? 0)) {
      const full = await session.getConversation(conversation.id);
      if (matches(full)) return full;
    }
  }
}

function SupportConversationContent({
  session,
  active,
  route,
  sessionError,
  onCreated,
}: {
  session?: IIntercomMessengerSession;
  active: boolean;
  route: IIntercomSupportRoute;
  sessionError?: () => void;
  onCreated: (id: string) => void;
}) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IModalNavigationProp<IIntercomParamList>>();
  const [conversationId, setConversationId] = useState(route.conversationId);
  const load = useCallback(async () => {
    if (!session) throw new OneKeyLocalError('Support session is unavailable');
    if (conversationId) {
      const conversation = await session.getConversation(conversationId);
      return { conversation, open: undefined };
    }
    return {
      conversation: undefined,
      open: await session.getOpen(),
    };
  }, [session, conversationId]);
  const resource = useSupportResource(load, active, !!conversationId);
  const refreshConversation = resource.refresh;
  const [draft, setDraft] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [image, setImage] = useState<IPickedImage>();
  const [pending, setPending] = useState<IOutgoing>();
  const [confirmed, setConfirmed] = useState<IIntercomPart[]>([]);
  const [createdConversation, setCreatedConversation] =
    useState<IIntercomConversation>();
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
  const current =
    resource.data?.conversation ??
    (createdConversation?.id === conversationId
      ? createdConversation
      : undefined);
  const open = resource.data?.open;
  const acceptConversation = useCallback(
    (conversation: IIntercomConversation) => {
      if (!alive.current) return;
      setCreatedConversation(conversation);
      setConfirmed(conversation.parts);
      setConversationId(conversation.id);
      setPending(undefined);
      onCreated(conversation.id);
      navigation.setParams({ conversationId: conversation.id });
    },
    [navigation, onCreated],
  );
  const recoverCreation = useCallback(async () => {
    if (!session || !pending) return undefined;
    return findCreatedConversation(session, pending);
  }, [session, pending]);
  const recovery = useSupportResource(
    recoverCreation,
    active && !conversationId && pending?.status === 'failed',
    true,
  );
  useEffect(() => {
    if (recovery.data) acceptConversation(recovery.data);
  }, [recovery.data, acceptConversation]);
  const lastReceiptData = useRef<IIntercomConversation | undefined>(undefined);
  useEffect(() => {
    if (current === lastReceiptData.current) return;
    lastReceiptData.current = current;
    if (active && current && !current.read && current.id === conversationId)
      // Mark only a conversation committed to the active screen as read.
      void session?.markRead(current.id).catch(() => undefined);
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
  useEffect(() => {
    setPending((previous) =>
      previous && parts.some((part) => part.clientId === previous.id)
        ? undefined
        : previous,
    );
  }, [parts]);
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
      let prepared: IOutgoing = {
        ...outgoing,
        createdAt: outgoing.createdAt ?? Math.floor(Date.now() / 1000),
      };
      setPending({ ...prepared, status: 'sending' });
      followLatest();
      try {
        await session.assertCurrent();
        if (!alive.current) return;
        if (outgoing.status === 'failed') {
          const accepted = conversationId
            ? await session.getConversation(conversationId)
            : await findCreatedConversation(session, outgoing);
          if (accepted?.parts.some((part) => part.clientId === outgoing.id)) {
            if (alive.current) {
              if (conversationId) {
                setConfirmed(accepted.parts);
                setPending(undefined);
              } else acceptConversation(accepted);
            }
            return;
          }
          if (!alive.current) return;
        }
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
        const message = {
          clientId: prepared.id,
          createdAt: prepared.createdAt,
          blocks,
        };
        if (conversationId) {
          const part = prepared.quickReply
            ? await session.quickReply(conversationId, {
                clientId: prepared.id,
                partId: prepared.quickReply.partId,
                replyId: prepared.quickReply.replyId,
                text: prepared.text,
              })
            : await session.reply(conversationId, message);
          if (alive.current) setConfirmed((previous) => [...previous, part]);
        } else {
          if (!open)
            throw new OneKeyLocalError('Support composer is unavailable');
          const conversation = await session.createConversation({
            message,
            open,
            quickReplyId: prepared.quickReply?.replyId,
          });
          acceptConversation(conversation);
        }
        if (alive.current) {
          setPending(undefined);
          // A refresh failure must not turn an acknowledged send into a retry.
          void refreshConversation();
        }
      } catch {
        if (alive.current) {
          // A poll may already have acknowledged this UUID while the original
          // request was timing out. Never resurrect its failed placeholder.
          setPending((previous) =>
            previous?.id === prepared.id
              ? { ...prepared, status: 'failed' }
              : previous,
          );
          void refreshConversation();
        }
      } finally {
        sending.current = false;
      }
    },
    [
      active,
      session,
      conversationId,
      open,
      acceptConversation,
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
                cachePolicy="none"
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
                      if (!session || !conversationId) return false;
                      await session.submitForm(conversationId, {
                        partId,
                        identifier,
                        value,
                      });
                      return !!(await resource.refreshData());
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
                      cachePolicy="none"
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

function SupportConversationRoute(props: ISupportSessionProps) {
  const [identity, setIdentity] = useState<{
    routeId?: string;
    createdId?: string;
    key: number;
  }>({ routeId: props.route.conversationId, key: 0 });
  const onCreated = useCallback((id: string) => {
    setIdentity((previous) => ({ ...previous, createdId: id }));
  }, []);
  if (identity.routeId !== props.route.conversationId) {
    const promoted =
      identity.createdId !== undefined &&
      identity.createdId === props.route.conversationId;
    setIdentity({
      routeId: props.route.conversationId,
      key: promoted ? identity.key : identity.key + 1,
    });
  }
  return (
    <SupportConversationContent
      key={identity.key}
      {...props}
      onCreated={onCreated}
    />
  );
}

export default function SupportConversation() {
  return (
    <SupportSessionBoundary>
      {(props) => <SupportConversationRoute {...props} />}
    </SupportSessionBoundary>
  );
}
