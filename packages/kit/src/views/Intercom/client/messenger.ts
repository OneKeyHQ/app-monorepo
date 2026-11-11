import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createMessengerClient } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerClient';
import type { IIntercomVisitor } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerClient';
import { intercomRecord } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerModels';
import type {
  IIntercomConversation,
  IIntercomNotification,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import { notifyIntercomOpenFailed } from '@onekeyhq/shared/src/modules3rdParty/intercom/openFailure';
import {
  bindVisitorStorage,
  intercomVisitorStorageKey as storageKey,
  visitorStorage,
  withVisitorSessionLock,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/visitorStorage';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { getInstanceId } from '@onekeyhq/shared/src/utils/getInstanceId';

import {
  assertIntercomIdentity,
  getCurrentIntercomUserId,
  getIntercomCredentials,
  getIntercomLanguageOverride,
} from './identity';
import {
  isIntercomLocked as isLocked,
  markIntercomLockReady,
} from './lockState';
import { createIntercomOpenGuard } from './openGuard';
import { createSupportPollingTask } from './polling';
import { presentIntercomSupportUi } from './supportUi';

import type { IShowIntercomParams } from './openGuard';

const appId = process.env.INTERCOM_APP_ID || 'vbbj4ssb';
let owner: string | null | undefined;
let client: ReturnType<typeof createMessengerClient> | undefined;
let revision = 0;
let visible = false;
let visibilityRevision = 0;
let backgroundPollingReady = false;
let unreadIds = new Set<string>();
let unreadPolling: ReturnType<typeof createSupportPollingTask> | undefined;
let storageQueue: Promise<unknown> = Promise.resolve();
let identityTransition: Promise<void> | undefined;
let identitySyncRequired = false;
const listeners = new Set<() => void>();
const notificationListeners = new Set<() => void>();
let notification: IIntercomNotification | undefined;
let pushedConversationId: string | undefined;
const openGuard = createIntercomOpenGuard(notifyIntercomOpenFailed);

function setUnread(ids: string[]) {
  unreadIds = new Set(ids);
  if (notification && !unreadIds.has(notification.conversationId))
    setNotification(undefined);
  listeners.forEach((listener) => listener());
}
function storageOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = storageQueue.catch(() => undefined).then(operation);
  storageQueue = next;
  return next;
}
function parseVisitor(raw: string | null) {
  if (!raw) return undefined;
  let data: Record<string, unknown>;
  try {
    data = intercomRecord(JSON.parse(raw));
  } catch {
    return undefined;
  }
  return typeof data.anonymousId === 'string' &&
    typeof data.anonymousSession === 'string' &&
    typeof data.expiresAt === 'number' &&
    data.expiresAt > Date.now()
    ? (data as IIntercomVisitor)
    : undefined;
}
function setNotification(value: IIntercomNotification | undefined) {
  notification = value;
  notificationListeners.forEach((listener) => listener());
}

function invalidate() {
  revision += 1;
  client?.dispose();
  client = undefined;
  setUnread([]);
  setNotification(undefined);
  pushedConversationId = undefined;
}
export const getIntercomUnreadCount = () => unreadIds.size;
export const subscribeToIntercomUnreadCount = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getIntercomNotification = () => notification;
export const subscribeToIntercomNotifications = (listener: () => void) => {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
};

export function dismissIntercomNotification(id: string) {
  if (notification?.id === id) setNotification(undefined);
}

async function updateMessageNotification(
  conversations: IIntercomConversation[],
  userId: string | null,
  assertCurrent: () => Promise<void>,
) {
  if (!conversations.length) return;
  const expectedVisibility = visibilityRevision;
  const canDeliver = () =>
    expectedVisibility === visibilityRevision &&
    visible &&
    !isLocked() &&
    notificationListeners.size > 0;
  const key = `${storageKey}-notifications`;
  await withVisitorSessionLock(key, async () => {
    await assertCurrent();
    if (!canDeliver()) return;
    const notifiedParts = new Map<
      string,
      { partId: string; createdAt: number }
    >();
    const raw = await appStorage.getItem(key);
    try {
      const entries: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(entries)) {
        for (const value of entries.slice(-200)) {
          const entry = intercomRecord(value);
          if (
            typeof entry.key === 'string' &&
            typeof entry.partId === 'string' &&
            typeof entry.createdAt === 'number'
          )
            notifiedParts.set(entry.key, {
              partId: entry.partId,
              createdAt: entry.createdAt,
            });
        }
      }
    } catch {
      // Corrupt notification metadata must not block delivery of new replies.
    }
    let latest:
      | {
          message: IIntercomNotification;
          createdAt: number;
        }
      | undefined;
    conversations.forEach((conversation) => {
      const part = conversation.parts
        .filter((item) => item.blocks.length)
        .at(-1);
      if (!part?.id) return;
      const entryKey = JSON.stringify([userId, conversation.id]);
      const previous = notifiedParts.get(entryKey);
      if (previous && previous.createdAt > part.createdAt) return;
      notifiedParts.delete(entryKey);
      notifiedParts.set(entryKey, {
        partId: part.id,
        createdAt: part.createdAt,
      });
      if (conversation.read) {
        if (notification?.conversationId === conversation.id)
          setNotification(undefined);
        return;
      }
      if (!part.isAdmin || previous?.partId === part.id) return;
      if (!latest || part.createdAt > latest.createdAt) {
        latest = {
          createdAt: part.createdAt,
          message: {
            id: `${conversation.id}:${part.id}`,
            conversationId: conversation.id,
            author: part.author,
            avatarUrl: part.avatar?.imageUrl,
            message: part.blocks
              .map((block) => block.text || block.items?.join('\n') || '')
              .filter(Boolean)
              .join('\n')
              .slice(0, 240),
          },
        };
      }
    });
    await assertCurrent();
    if (!canDeliver()) return;
    if (latest) {
      // One preview represents this observed batch. Publish the newest reply
      // before committing the batch, so older replies do not trickle out later.
      setNotification(latest.message);
    }
    // Persist only bounded IDs/timestamps, never message text or credentials.
    // The shared lock deduplicates previews across extension windows and restarts.
    while (notifiedParts.size > 200) {
      const first = notifiedParts.keys().next().value;
      if (first === undefined) break;
      notifiedParts.delete(first);
    }
    await appStorage.setItem(
      key,
      JSON.stringify(
        Array.from(notifiedParts, ([entryKey, value]) => ({
          key: entryKey,
          ...value,
        })),
      ),
    );
  });
}

export async function openIntercomNotification(id: string) {
  const current = notification;
  const expectedOwner = owner;
  if (!current || current.id !== id || expectedOwner === undefined) return;
  try {
    await initIntercom();
    if (notification !== current || owner !== expectedOwner) return;
    await openGuard.run(
      expectedOwner,
      { conversationId: current.conversationId },
      async (canPresent) => {
        if (!client) return false;
        await client.assertCurrent();
        if (notification !== current || !visible || isLocked() || !canPresent())
          return false;
        if (
          !presentIntercomSupportUi({
            userId: expectedOwner,
            conversationId: current.conversationId,
          })
        )
          throw new OneKeyLocalError('Support navigation is not ready');
        dismissIntercomNotification(id);
        return true;
      },
    );
  } catch (error) {
    notifyIntercomOpenFailed(error);
  }
}

export function refreshIntercomNotifications(conversationId?: string) {
  if (isLocked()) return;
  if (conversationId && /^\d+$/.test(conversationId))
    pushedConversationId = conversationId;
  if (visible) {
    ensureUnreadPolling();
    unreadPolling?.push();
  }
}

export async function initIntercom(): Promise<void> {
  const userId = await getCurrentIntercomUserId();
  if (identityTransition) {
    await identityTransition;
    return initIntercom();
  }
  if (userId === owner && !identitySyncRequired) return;
  invalidate();
  openGuard.setIdentity(userId);
  identitySyncRequired = true;
  const transition = (async () => {
    // Never merge an anonymous conversation into a signed-in account, or keep
    // the previous visitor after a logout on a shared installation.
    await storageOperation(() =>
      visitorStorage.syncIdentity(storageKey, userId, () =>
        assertIntercomIdentity(userId),
      ),
    );
    identitySyncRequired = false;
    owner = userId;
  })();
  identityTransition = transition;
  try {
    await transition;
  } finally {
    if (identityTransition === transition) identityTransition = undefined;
  }
  if (visible && !isLocked()) {
    ensureUnreadPolling();
    void unreadPolling?.refresh();
  }
}

export async function createIntercomMessengerSession(
  expectedUserId: string | null,
  context?: { requestId?: string },
) {
  await initIntercom();
  if (isLocked() || owner !== expectedUserId)
    throw new OneKeyLocalError('Support session changed');
  if (!client) {
    const generation = revision;
    let visitorBinding: ReturnType<typeof bindVisitorStorage> | undefined;
    const assertCurrent = async () => {
      const userId = await getCurrentIntercomUserId();
      if (isLocked() || generation !== revision || userId !== expectedUserId)
        throw new OneKeyLocalError('Support session changed');
      if (visitorBinding) {
        try {
          await (await visitorBinding).assertCurrent();
        } catch (error) {
          if (generation === revision) invalidate();
          throw error;
        }
      }
    };
    client = createMessengerClient({
      appId,
      assertCurrent,
      withBootLock: async (initialize) => {
        if (expectedUserId !== null) return initialize();
        // The lock covers root creation, ping and credential commit across
        // extension windows. Reset still revokes the root immediately.
        return withVisitorSessionLock(storageKey, async () => {
          await assertCurrent();
          visitorBinding ??= storageOperation(() =>
            bindVisitorStorage(storageKey),
          );
          await visitorBinding;
          await assertCurrent();
          await initialize();
        });
      },
      getIdentity: async () => {
        const [credentials, language] = await Promise.all([
          expectedUserId ? getIntercomCredentials(expectedUserId) : undefined,
          getIntercomLanguageOverride(),
        ]);
        await assertCurrent();
        if (expectedUserId && !credentials)
          throw new OneKeyLocalError('Support identity is unavailable');
        return { token: credentials?.token, language };
      },
      loadVisitor: () =>
        storageOperation(async () => {
          await assertCurrent();
          const raw = visitorBinding
            ? await (await visitorBinding).get()
            : null;
          return parseVisitor(raw);
        }),
      saveVisitor: (visitor) =>
        storageOperation(async () => {
          await assertCurrent();
          await (await visitorBinding)?.set(JSON.stringify(visitor));
        }),
      onRead: (id) => {
        if (generation !== revision || isLocked()) return;
        if (unreadIds.has(id))
          setUnread([...unreadIds].filter((value) => value !== id));
        if (notification?.conversationId === id) setNotification(undefined);
      },
      onUnread: (ids) => {
        if (generation === revision && !isLocked()) setUnread(ids);
      },
    });
  }
  const active = client;
  await active.boot();
  await active.assertCurrent();
  if (context) {
    // Preserve order/diagnostic context without making message availability
    // depend on an auxiliary metadata request.
    void getInstanceId()
      .then((instanceId) =>
        active.setContext({ instanceId, requestId: context.requestId }),
      )
      .catch(() => undefined);
  }
  return active.api;
}

async function pollUnread() {
  if (!visible || isLocked()) {
    stopUnreadPolling();
    return;
  }
  const conversationId = pushedConversationId;
  pushedConversationId = undefined;
  const userId = await getCurrentIntercomUserId();
  // Background badges may restore a visitor, but only an explicit support
  // open may create an anonymous identity for someone who has never used it.
  if (
    userId === null &&
    !parseVisitor(await storageOperation(() => visitorStorage.get(storageKey)))
  )
    return;
  const session = await createIntercomMessengerSession(userId);
  await session.refreshUnread();
  if (visible && !isLocked() && notificationListeners.size) {
    let conversations: IIntercomConversation[] = [];
    if (conversationId) {
      conversations = [await session.getConversation(conversationId)];
    } else if (unreadIds.size) {
      conversations = (await session.listConversations()).conversations;
    }
    await session.assertCurrent();
    if (visible && !isLocked())
      await updateMessageNotification(
        conversations,
        userId,
        session.assertCurrent,
      );
  }
}
function ensureUnreadPolling() {
  if (!backgroundPollingReady || !visible || isLocked() || unreadPolling)
    return;
  unreadPolling = createSupportPollingTask(pollUnread, 30_000);
  void unreadPolling.refresh();
}
export async function startIntercomBackgroundPolling() {
  backgroundPollingReady = true;
  try {
    await initIntercom();
  } finally {
    ensureUnreadPolling();
  }
}
function stopUnreadPolling() {
  unreadPolling?.stop();
  unreadPolling = undefined;
}
export async function setIntercomInAppMessageVisibility(value: boolean) {
  if (visible === value) return;
  visible = value;
  visibilityRevision += 1;
  if (!visible) {
    stopUnreadPolling();
    setNotification(undefined);
  } else ensureUnreadPolling();
}
export async function syncIntercomLockState() {
  await markIntercomLockReady();
  if (isLocked()) {
    stopUnreadPolling();
    invalidate();
    openGuard.reset();
  } else ensureUnreadPolling();
}
export async function showIntercom(params?: IShowIntercomParams) {
  try {
    await initIntercom();
    const userId = await getCurrentIntercomUserId();
    await openGuard.run(userId, params, async (canPresent) => {
      if (
        isLocked() ||
        !canPresent() ||
        userId !== (await getCurrentIntercomUserId())
      )
        return false;
      if (
        !presentIntercomSupportUi({
          userId,
          requestId: params?.requestId,
          conversationId: params?.conversationId,
        })
      )
        throw new OneKeyLocalError('Support navigation is not ready');
      return true;
    });
  } catch (error) {
    notifyIntercomOpenFailed(error);
  }
}
