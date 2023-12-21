/* eslint-disable @typescript-eslint/no-unused-vars */

import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBSimpleAccount } from '../../../dbs/local/types';
import type { IPrepareHardwareAccountsParams } from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.evm.hd;

  async signTransaction(): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  async signMessage(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<IDBSimpleAccount>> {
    throw new Error('Method not implemented.');
  }
}
