import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import { KeyringImported as KeyringImportedBtc } from '../btc/KeyringImported';

export class KeyringImported extends KeyringImportedBtc {
  override coreApi = coreChainApi.bch.imported;
}
