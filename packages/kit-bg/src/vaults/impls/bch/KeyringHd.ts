import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import { KeyringHd as KeyringHdBtc } from '../btc/KeyringHd';

export class KeyringHd extends KeyringHdBtc {
  override coreApi = coreChainApi.bch.hd;
}
