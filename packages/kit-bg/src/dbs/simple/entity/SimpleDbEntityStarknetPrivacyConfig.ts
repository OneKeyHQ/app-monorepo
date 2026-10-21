import type { IStrk20PrivacyConfigEnvelope } from '@onekeyhq/shared/types/starknetPrivacy';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

/**
 * Remote STRK20 endpoint config, stored as a verbatim envelope like the IP
 * table. Standalone on purpose: IServerNetwork.extensions cannot carry it,
 * because getAllNetworksWithCache inserts the preset starknet--mainnet and
 * starknet--sepolia entries first and addNetworks skips ids already present,
 * so server-only fields on those two networks are silently dropped.
 */
export interface IStarknetPrivacyConfigDBStruct {
  envelope?: IStrk20PrivacyConfigEnvelope;
  /** Wall clock of the last successful fetch; drives 1h stale-while-revalidate. */
  syncedAt?: number;
}

export class SimpleDbEntityStarknetPrivacyConfig extends SimpleDbEntityBase<IStarknetPrivacyConfigDBStruct> {
  entityName = 'starknetPrivacyConfig';

  // One small payload with a single writer, read on every availability check.
  override enableCache = true;

  async getEnvelope(): Promise<{
    envelope: IStrk20PrivacyConfigEnvelope | undefined;
    syncedAt: number | undefined;
  }> {
    const rawData = await this.getRawData();
    return { envelope: rawData?.envelope, syncedAt: rawData?.syncedAt };
  }

  /**
   * Keeps the last good envelope when the incoming one is older: a rollback on
   * the server must not downgrade a client that already saw a newer config.
   */
  async saveEnvelope(params: {
    envelope: IStrk20PrivacyConfigEnvelope;
    syncedAt: number;
  }): Promise<void> {
    await this.setRawData((rawData) => {
      const current = rawData?.envelope;
      if (current && current.version > params.envelope.version) {
        return { envelope: current, syncedAt: params.syncedAt };
      }
      return { envelope: params.envelope, syncedAt: params.syncedAt };
    });
  }
}
