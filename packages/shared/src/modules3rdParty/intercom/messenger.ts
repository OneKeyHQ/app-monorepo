import { OneKeyLocalError } from '../../errors';

import { getCurrentIntercomUserId, getIntercomCredentials } from './identity';
import { createMessengerClient } from './messengerClient';
import { intercomRecord } from './messengerModels';
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
function invalidate() {
  revision += 1;
  client?.dispose();
  client = undefined;
  clearTimeout(timer);
  timer = undefined;
  setUnread([]);
}
export const getIntercomUnreadCount = () => unreadIds.size;
export const subscribeToIntercomUnreadCount = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

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
      return result;
    },
  };
}

async function pollUnread() {
  clearTimeout(timer);
  if (!visible || isLocked() || polling) return;
  polling = true;
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
  } catch {
    // Retry on the next foreground tick; never show background error toasts.
  } finally {
    polling = false;
    if (visible && !isLocked())
      timer = setTimeout(() => {
        void pollUnread();
      }, 30_000);
  }
}
export async function setIntercomInAppMessageVisibility(value: boolean) {
  if (visible === value) return;
  visible = value;
  clearTimeout(timer);
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
    invalidate();
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
