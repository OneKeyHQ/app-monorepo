import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Trezor THP pairing credentials persisted across SW restarts. Stored in
// plaintext to match the rest of simpleDb; encryption could be layered on
// later but the credential itself doesn't grant arbitrary key access — it
// only short-circuits the CodeEntry/QrCode/NFC pairing UX. The host still
// needs to be physically present and approved on device for any signing.
//
// Shape (mirrors `TrezorThpCredentials` from @onekeyfe/hwk-trezor-core):
//   { credential: hex, host_static_key: hex, autoconnect: boolean, ... }
// We type it as `Record<string, unknown>` here because the host doesn't
// need to inspect the shape — credentials are opaque blobs that get
// shipped back to the device verbatim on the next handshake.

export type ITrezorThpCredential = Record<string, unknown>;

interface ITrezorThpCredentialsData {
  credentials: ITrezorThpCredential[];
}

const DEFAULT_DATA: ITrezorThpCredentialsData = {
  credentials: [],
};

export class SimpleDbEntityTrezorThpCredentials extends SimpleDbEntityBase<ITrezorThpCredentialsData> {
  entityName = 'trezorThpCredentials';

  override enableCache = false;

  @backgroundMethod()
  async getCredentials(): Promise<ITrezorThpCredential[]> {
    const data = (await this.getRawData()) ?? DEFAULT_DATA;
    return data.credentials ?? [];
  }

  /**
   * Replace stored credentials with `incoming`. Connector's
   * onPairingCredentialsChanged already emits the full list (existing +
   * newly-minted), so a replace-and-store keeps SW and connector arrays
   * trivially in sync.
   */
  @backgroundMethod()
  async setCredentials(incoming: ITrezorThpCredential[]): Promise<void> {
    await this.setRawData({ credentials: incoming ?? [] });
  }

  /** Drop all stored credentials. Used on "wipe device" / "remove wallet". */
  @backgroundMethod()
  async clear(): Promise<void> {
    await this.setRawData(DEFAULT_DATA);
  }
}
