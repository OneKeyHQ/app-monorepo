import type { IBinanceDepositLocalSession } from '@onekeyhq/shared/types/exchange';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDbBinanceDeposit {
  session?: IBinanceDepositLocalSession;
}

/**
 * The Binance Connect deposit session started on this device, one at a time.
 * Nothing in it is a credential: the session key lives in secure storage
 * (keyed by `localId`), the return nonce and the Binance link only ever live
 * in background memory.
 */
export class SimpleDbEntityBinanceDeposit extends SimpleDbEntityBase<ISimpleDbBinanceDeposit> {
  entityName = 'binanceDeposit';

  override enableCache = false;

  async getSession(): Promise<IBinanceDepositLocalSession | undefined> {
    return (await this.getRawData())?.session ?? undefined;
  }

  async setSession(session: IBinanceDepositLocalSession | undefined) {
    await this.setRawData({ session });
  }

  // Applies `updater` only when the stored session is still `localId`.
  async updateSession(
    localId: string,
    updater: (
      session: IBinanceDepositLocalSession,
    ) => IBinanceDepositLocalSession,
  ): Promise<IBinanceDepositLocalSession | undefined> {
    let updated: IBinanceDepositLocalSession | undefined;
    await this.setRawData((rawData) => {
      const session = rawData?.session;
      if (!session || session.localId !== localId) {
        return rawData ?? {};
      }
      updated = { ...updater(session), updatedAt: Date.now() };
      return { session: updated };
    });
    return updated;
  }
}
