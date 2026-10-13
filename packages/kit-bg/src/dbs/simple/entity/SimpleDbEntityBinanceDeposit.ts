import { BINANCE_DEPOSIT_MAX_LOCAL_SESSIONS } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import {
  isBinanceDepositSessionClosed,
  isBinanceDepositSessionInProgress,
} from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import type { IBinanceDepositLocalSession } from '@onekeyhq/shared/types/exchange';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDbBinanceDeposit {
  sessions: Record<string, IBinanceDepositLocalSession>;
  // The session the self-test page is showing: the most recently created one.
  activeLocalId?: string;
}

export interface IBinanceDepositLocalSessionList {
  sessions: IBinanceDepositLocalSession[];
  activeLocalId?: string;
}

export interface IBinanceDepositAddSessionResult {
  added: boolean;
  // Set when the session was refused because this one is still in progress.
  inProgressLocalId?: string;
  // Records dropped to stay within the cap. The caller owns removing their
  // session keys from secure storage.
  evicted: IBinanceDepositLocalSession[];
}

// Returns the next record, or undefined to leave the stored one untouched.
export type IBinanceDepositSessionUpdater = (
  session: IBinanceDepositLocalSession,
) => IBinanceDepositLocalSession | undefined;

function normalizeData(
  rawData: ISimpleDbBinanceDeposit | null | undefined,
): ISimpleDbBinanceDeposit {
  const sessions: Record<string, IBinanceDepositLocalSession> = {};
  const rawSessions: unknown = rawData?.sessions;
  if (rawSessions && typeof rawSessions === 'object') {
    Object.entries(
      rawSessions as Record<string, IBinanceDepositLocalSession | undefined>,
    ).forEach(([localId, session]) => {
      if (session && typeof session === 'object') {
        sessions[localId] = session;
      }
    });
  }
  const activeLocalId =
    typeof rawData?.activeLocalId === 'string' && rawData.activeLocalId
      ? rawData.activeLocalId
      : undefined;
  return { sessions, activeLocalId };
}

// A session can be dropped once it has nothing left to deliver: it is closed,
// or its report was refused for good. An AUTHORIZED session whose report is
// missing or still pending is never dropped, it may still have to report a
// broadcast transaction.
function canDropSession(session: IBinanceDepositLocalSession): boolean {
  return (
    isBinanceDepositSessionClosed(session) ||
    session.report?.status === 'FAILED'
  );
}

/**
 * Plain-text index of Binance Connect deposit sessions started on this
 * device. Nothing in it is a credential: the session key lives in
 * secureStorage (keyed by `localId`), the return nonce and the Binance link
 * only ever live in background memory.
 */
export class SimpleDbEntityBinanceDeposit extends SimpleDbEntityBase<ISimpleDbBinanceDeposit> {
  entityName = 'binanceDeposit';

  override enableCache = false;

  async getSessionList(): Promise<IBinanceDepositLocalSessionList> {
    const { sessions, activeLocalId } = normalizeData(await this.getRawData());
    return { sessions: Object.values(sessions), activeLocalId };
  }

  async getSession(
    localId: string,
  ): Promise<IBinanceDepositLocalSession | undefined> {
    const { sessions } = normalizeData(await this.getRawData());
    return sessions[localId];
  }

  // Inserts a new session and makes it the active one. Refused while another
  // session is in progress: the check and the insert share one write, so two
  // concurrent creates cannot both pass.
  async addSession(
    session: IBinanceDepositLocalSession,
  ): Promise<IBinanceDepositAddSessionResult> {
    const result: IBinanceDepositAddSessionResult = {
      added: false,
      evicted: [],
    };
    await this.setRawData((rawData) => {
      const data = normalizeData(rawData);
      const inProgress = Object.values(data.sessions).find((item) =>
        isBinanceDepositSessionInProgress(item),
      );
      if (inProgress) {
        result.inProgressLocalId = inProgress.localId;
        return data;
      }

      data.sessions[session.localId] = session;
      data.activeLocalId = session.localId;

      const droppable = Object.values(data.sessions)
        .filter(
          (item) => item.localId !== session.localId && canDropSession(item),
        )
        .toSorted((a, b) => a.updatedAt - b.updatedAt);
      while (
        Object.keys(data.sessions).length >
          BINANCE_DEPOSIT_MAX_LOCAL_SESSIONS &&
        droppable.length > 0
      ) {
        const victim = droppable.shift();
        if (victim) {
          delete data.sessions[victim.localId];
          result.evicted.push(victim);
        }
      }

      result.added = true;
      return data;
    });
    return result;
  }

  // Read-modify-write of one session under the entity lock. Resolves to the
  // stored record after the call, or undefined when the session is unknown.
  async updateSession(
    localId: string,
    updater: IBinanceDepositSessionUpdater,
  ): Promise<IBinanceDepositLocalSession | undefined> {
    let stored: IBinanceDepositLocalSession | undefined;
    await this.setRawData((rawData) => {
      const data = normalizeData(rawData);
      const current = data.sessions[localId];
      if (!current) {
        return data;
      }
      const next = updater(current);
      if (!next) {
        stored = current;
        return data;
      }
      // The id is the secure storage key suffix; an updater must not move it.
      stored = { ...next, localId, updatedAt: Date.now() };
      data.sessions[localId] = stored;
      return data;
    });
    return stored;
  }
}
