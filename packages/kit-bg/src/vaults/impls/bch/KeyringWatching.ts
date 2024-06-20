import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import { KeyringWatching as KeyringWatchingBtc } from '../btc/KeyringWatching';

export class KeyringWatching extends KeyringWatchingBtc {
  override coreApi = coreChainApi.bch.hd;
}
