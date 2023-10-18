import {
  EVaultKeyringTypes,
  type IPrepareAccountByAddressIndexParams,
} from '../types';

import { KeyringSoftwareBase } from './KeyringSoftwareBase';

import type { DBAccount } from '../../types/account';

export abstract class KeyringHdBase extends KeyringSoftwareBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.hd;

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }

  override prepareAccountByAddressIndex(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }
}
