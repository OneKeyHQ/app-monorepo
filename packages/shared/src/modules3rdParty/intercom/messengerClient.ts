import { OneKeyLocalError } from '../../errors';
import { generateUUID } from '../../utils/miscUtils';

import { createMessengerApi } from './messengerApi';
import { intercomRecord } from './messengerModels';

export type IIntercomVisitor = {
  anonymousId: string;
  anonymousSession: string;
  expiresAt: number;
};

type IClientOptions = {
  appId: string;
  assertCurrent: () => Promise<void>;
  getIdentity: () => Promise<{ token?: string; language: string }>;
  loadVisitor: () => Promise<IIntercomVisitor | undefined>;
  saveVisitor: (visitor: IIntercomVisitor) => Promise<void>;
  onUnread: (ids: string[]) => void;
  onRead?: (id: string) => void;
  withBootLock?: (initialize: () => Promise<void>) => Promise<void>;
};

// This undocumented end-user Messenger protocol is separate from the admin
// REST API. Keep protocol changes isolated here, in messengerApi and messengerModels. Never
// send an admin access token here or replay a mutation automatically on failure.
export function createMessengerClient(options: IClientOptions) {
  let disposed = false;
  let visitor: IIntercomVisitor | undefined;
  let identity: { token?: string; language: string } | undefined;
  let booting: Promise<void> | undefined;
  let bootedAt = 0;
  let inboundDisabled = false;
  let messengerConfiguration: Record<string, unknown> = {};
  const sessionId = generateUUID();
  const controllers = new Set<AbortController>();
  const contexts = new Set<string>();
  const assertCurrent = async () => {
    await options.assertCurrent();
    if (disposed) throw new OneKeyLocalError('Support session changed');
  };
  const post = async (
    path: string,
    parameters: Record<string, unknown> = {},
  ) => {
    await assertCurrent();
    // Restrict the transport to the small set of end-user operations we render.
    if (
      !/^(ping|open|home|articles\/search|events|new_conversation_content|messages|uploads|conversations(?:\/unread|\/\d+(?:\/(?:reply|read|quick_reply|form))?)?|custom_bots\/trigger_inbound_conversation)$/.test(
        path,
      )
    )
      throw new OneKeyLocalError('Unsupported support operation');
    const userData = identity?.token
      ? {
          intercom_user_jwt: identity.token,
          language_override: identity.language,
        }
      : {
          anonymous_id: visitor?.anonymousId,
          language_override: identity?.language,
        };
    const fields: Record<string, unknown> = {
      ...parameters,
      app_id: options.appId,
      v: 3,
      platform: 'web',
      s: sessionId,
      referer: 'https://app.onekey.so',
      user_data: JSON.stringify(userData),
      anonymous_session: identity?.token
        ? undefined
        : visitor?.anonymousSession,
      'Idempotency-Key':
        typeof parameters.client_assigned_uuid === 'string'
          ? parameters.client_assigned_uuid
          : generateUUID(),
    };
    const body = Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(typeof value === 'object' ? JSON.stringify(value) : String(value))}`,
      )
      .join('&');
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(
        `https://api-iam.intercom.io/messenger/web/${path}`,
        {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          signal: controller.signal,
        },
      );
      await assertCurrent();
      if (response.status === 401 || response.status === 403) bootedAt = 0;
      if (!response.ok)
        throw new OneKeyLocalError(
          `Support request failed (${response.status})`,
        );
      const data: unknown = await response.json();
      await assertCurrent();
      const record = intercomRecord(data);
      if (record.errors || record.jwt_expired === true) {
        bootedAt = 0;
        throw new OneKeyLocalError('Support session could not be verified');
      }
      if (Array.isArray(record.unread_conversation_ids))
        options.onUnread(record.unread_conversation_ids.map(String));
      return data;
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  };
  const boot = async () => {
    await assertCurrent();
    if (
      bootedAt &&
      Date.now() - bootedAt < 5 * 60_000 &&
      (identity?.token || (visitor && visitor.expiresAt > Date.now() + 60_000))
    )
      return;
    if (!booting) {
      const initialize = async () => {
        identity = await options.getIdentity();
        await assertCurrent();
        if (identity.token) {
          visitor = undefined;
        } else {
          // A different window may have refreshed the shared visitor while
          // this client waited for the boot lock. Storage is authoritative.
          visitor = await options.loadVisitor();
          if (visitor && visitor.expiresAt <= Date.now()) visitor = undefined;
        }
        await assertCurrent();
        const data = intercomRecord(await post('ping', { source: 'api' }));
        if (!intercomRecord(data.user).id)
          throw new OneKeyLocalError('Support session is unavailable');
        inboundDisabled =
          intercomRecord(data.app).inbound_conversations_disabled === true;
        const modules = intercomRecord(data.modules);
        messengerConfiguration = {
          home: modules.home,
          customization: modules.customization,
        };
        if (!identity.token) {
          const anonymousId = intercomRecord(data.user).anonymous_id;
          const anonymousSession = data.anonymous_session;
          if (
            typeof anonymousId !== 'string' ||
            typeof anonymousSession !== 'string'
          )
            throw new OneKeyLocalError('Invalid support visitor session');
          visitor = {
            anonymousId,
            anonymousSession,
            expiresAt:
              typeof data.session_expiry === 'number'
                ? data.session_expiry * 1000
                : Date.now() + 24 * 60 * 60_000,
          };
          await options.saveVisitor(visitor);
          await assertCurrent();
        }
        bootedAt = Date.now();
      };
      booting = (
        options.withBootLock ? options.withBootLock(initialize) : initialize()
      ).finally(() => {
        booting = undefined;
      });
    }
    await booting;
  };
  return {
    boot,
    assertCurrent,
    async setContext(metadata: { instanceId?: string; requestId?: string }) {
      const key = metadata.requestId ?? '';
      if (contexts.has(key)) return;
      contexts.add(key);
      try {
        await boot();
        await post('events', {
          event_list: { data: [{ event_name: 'client info', metadata }] },
        });
      } catch (error) {
        contexts.delete(key);
        throw error;
      }
    },
    api: createMessengerApi({
      assertCurrent,
      onRead: options.onRead,
      request: async (
        path: string,
        parameters?: Record<string, unknown>,
      ): Promise<unknown> => {
        await boot();
        const data = await post(path, parameters);
        return path === 'new_conversation_content'
          ? {
              ...intercomRecord(data),
              inbound_conversations_disabled: inboundDisabled,
              messenger_configuration: messengerConfiguration,
            }
          : data;
      },
    }),
    dispose() {
      disposed = true;
      identity = undefined;
      visitor = undefined;
      messengerConfiguration = {};
      controllers.forEach((controller) => controller.abort());
    },
  };
}
