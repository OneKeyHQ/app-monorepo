import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { INTERCOM_SUPPORT_ORIGIN } from '@onekeyhq/shared/src/modules3rdParty/intercom/bridge';
import type { IIntercomSupportContext } from '@onekeyhq/shared/src/modules3rdParty/intercom/bridge';

type IIntercomSession = {
  owner: string;
  expiresAt: number;
};

// Owned by bg only. The Intercom JWT is fetched only after a successful redemption.
export class IntercomSupportSessions {
  private sessions = new Map<string, IIntercomSession>();

  create(id: string, owner: string, now = Date.now()) {
    for (const [key, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(key);
    }
    if (this.sessions.size >= 20) this.sessions.clear();
    this.sessions.set(id, { owner, expiresAt: now + 120_000 });
    return id;
  }

  take(
    id: string,
    origin: string | undefined,
    owner: string,
    now = Date.now(),
  ) {
    if (origin !== INTERCOM_SUPPORT_ORIGIN) return false;
    const session = this.sessions.get(id);
    if (!session) return false;
    this.sessions.delete(id);
    return session.owner === owner && session.expiresAt > now;
  }

  async redeem({
    id,
    origin,
    getOwner,
    getContext,
  }: {
    id: string;
    origin?: string;
    getOwner: () => Promise<string>;
    getContext: () => Promise<IIntercomSupportContext>;
  }): Promise<IIntercomSupportContext> {
    const owner = await getOwner();
    if (!this.take(id, origin, owner)) {
      throw new OneKeyLocalError('Invalid or expired Support session');
    }
    const context = await getContext();
    if (owner !== (await getOwner())) {
      throw new OneKeyLocalError('Support identity changed');
    }
    return context;
  }
}
