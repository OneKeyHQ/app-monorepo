import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import { KeyringHardware as KeyringHardwareBtc } from '../btc/KeyringHardware';

export class KeyringHardware extends KeyringHardwareBtc {
  override coreApi = coreChainApi.bch.hd;
}
