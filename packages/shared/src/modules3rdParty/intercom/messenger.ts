import { OneKeyLocalError } from '../../errors';

import { getCurrentIntercomUserId, getIntercomCredentials } from './identity';
import { createMessengerClient } from './messengerClient';
import {
  intercomRecord,
  parseIntercomConversation,
  parseIntercomInbox,
} from './messengerModels';
import { notifyIntercomOpenFailed } from './openFailure';
import { presentIntercomSupportUi } from './supportUi';
import {
  createIntercomOpenGuard,
  getInstanceId,
  getIntercomLanguageOverride,
} from './utils';
import {
  bindVisitorStorage,
  intercomVisitorStorageKey as storageKey,
  visitorStorage,
  withVisitorSessionLock,
} from './visitorStorage';

import type { IIntercomVisitor } from './messengerClient';
import type {
  IIntercomConversation,
  IIntercomNotification,
} from './messengerTypes';
import type { IIntercomLockPolicy, IShowIntercomParams } from './utils';

const appId = process.env.INTERCOM_APP_ID || 'vbbj4ssb';
let owner: string | null | undefined;
let client: ReturnType<typeof createMessengerClient> | undefined;
let revision = 0;
let locked = false;
let lockPolicy: IIntercomLockPolicy | undefined;
let visible = false;
let polling = false;
let unreadIds = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let storageQueue: Promise<unknown> = Promise.resolve();
let identityTransition: Promise<void> | undefined;
let visitorCleanupRequired = false;
const listeners = new Set<() => void>();
const notificationListeners = new Set<() => void>();
const notifiedParts = new Map<string, string>();
let notification: IIntercomNotification | undefined;
let pushedConversationId: string | undefined;
let refreshQueued = false;
const openGuard = createIntercomOpenGuard(notifyIntercomOpenFailed);

function isLocked() {
  return (
    locked ||
    (!!lockPolicy &&
      (Date.now() < lockPolicy.validFromMs ||
        Date.now() >= lockPolicy.lockAtMs))
  );
}

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

function invalidate(clearNotifiedParts = true) {
  revision += 1;
  client?.dispose();
  client = undefined;
  clearTimeout(timer);
  timer = undefined;
  setUnread([]);
  setNotification(undefined);
  pushedConversationId = undefined;
  refreshQueued = false;
  if (clearNotifiedParts) notifiedParts.clear();
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

function updateMessageNotification(conversations: IIntercomConversation[]) {
  let latest: { message: IIntercomNotification; createdAt: number } | undefined;
  conversations.forEach((conversation) => {
    const part = conversation.parts.filter((item) => item.blocks.length).at(-1);
    if (!part?.id) return;
    const previous = notifiedParts.get(conversation.id);
    notifiedParts.set(conversation.id, part.id);
    if (conversation.read) {
      if (notification?.conversationId === conversation.id)
        setNotification(undefined);
      return;
    }
    if (!part.isAdmin || previous === part.id) return;
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
  // Retain only recent conversations; no message bodies survive dismissal.
  while (notifiedParts.size > 200) {
    const first = notifiedParts.keys().next().value;
    if (first === undefined) break;
    notifiedParts.delete(first);
  }
  if (latest) setNotification(latest.message);
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
  if (polling) refreshQueued = true;
  else void pollUnread();
}

export async function initIntercom(): Promise<void> {
  const userId = await getCurrentIntercomUserId();
  if (identityTransition) {
    await identityTransition;
    return initIntercom();
  }
  if (userId === owner && !visitorCleanupRequired) return;
  const previous = owner;
  invalidate();
  openGuard.setIdentity(userId);
  visitorCleanupRequired ||= previous !== undefined || userId !== null;
  const transition = (async () => {
    // Never merge an anonymous conversation into a signed-in account, or keep
    // the previous visitor after a logout on a shared installation.
    if (visitorCleanupRequired)
      await storageOperation(() => visitorStorage.remove(storageKey));
    visitorCleanupRequired = false;
    owner = userId;
  })();
  identityTransition = transition;
  try {
    await transition;
  } finally {
    if (identityTransition === transition) identityTransition = undefined;
  }
  if (visible && !isLocked()) void pollUnread();
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
  return {
    assertCurrent: active.assertCurrent,
    request: async (path: string, parameters?: Record<string, unknown>) => {
      const result = await active.request(path, parameters);
      const read = /^conversations\/(\d+)\/read$/.exec(path);
      if (read && unreadIds.has(read[1]))
        setUnread([...unreadIds].filter((id) => id !== read[1]));
      if (read && notification?.conversationId === read[1])
        setNotification(undefined);
      return result;
    },
  };
}

async function pollUnread() {
  clearTimeout(timer);
  if (!visible || isLocked() || polling) return;
  polling = true;
  refreshQueued = false;
  const conversationId = pushedConversationId;
  pushedConversationId = undefined;
  try {
    const userId = await getCurrentIntercomUserId();
    // Background badges may restore a visitor, but only an explicit support
    // open may create an anonymous identity for someone who has never used it.
    if (
      userId === null &&
      !parseVisitor(
        await storageOperation(() => visitorStorage.get(storageKey)),
      )
    )
      return;
    const session = await createIntercomMessengerSession(userId);
    await session.request('conversations/unread');
    if (visible && !isLocked() && notificationListeners.size) {
      let conversations: IIntercomConversation[] = [];
      if (conversationId) {
        conversations = [
          parseIntercomConversation(
            await session.request(`conversations/${conversationId}`),
          ),
        ];
      } else if (unreadIds.size) {
        conversations = parseIntercomInbox(
          await session.request('conversations', { per_page: 20 }),
        ).conversations;
      }
      await session.assertCurrent();
      if (visible && !isLocked()) updateMessageNotification(conversations);
    }
  } catch {
    // Retry on the next foreground tick; never show background error toasts.
  } finally {
    polling = false;
    if (visible && !isLocked())
      timer = setTimeout(
        () => {
          void pollUnread();
        },
        refreshQueued ? 0 : 30_000,
      );
  }
}
export async function setIntercomInAppMessageVisibility(value: boolean) {
  if (visible === value) return;
  visible = value;
  clearTimeout(timer);
  if (!visible) setNotification(undefined);
  if (visible && !isLocked()) void pollUnread();
}
export async function setIntercomMessengerLocked(
  value: boolean,
  policy?: IIntercomLockPolicy,
) {
  const wasLocked = isLocked();
  lockPolicy = policy;
  if (locked === value) {
    if (wasLocked && !isLocked() && visible) void pollUnread();
    return;
  }
  locked = value;
  if (locked) {
    invalidate(false);
    openGuard.reset();
  } else if (visible) void pollUnread();
}
export async function setIntercomTheme(
  _theme: 'light' | 'dark',
  _followSystem?: boolean,
) {
  // Shared RN components inherit the app theme directly.
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
export async function update() {
  await initIntercom();
}
