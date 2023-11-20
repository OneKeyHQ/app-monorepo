/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import {
  EVaultKeyringTypes,
  type IPrepareAccountByAddressIndexParams,
} from '../types';

import { KeyringBase } from './KeyringBase';

import type { IDBAccount } from '../../dbs/local/types';

export type IWalletPassphraseState = {
  passphraseState?: string;
  useEmptyPassphrase?: boolean;
};

export abstract class KeyringHardwareBase extends KeyringBase {
  override keyringType: EVaultKeyringTypes = EVaultKeyringTypes.hardware;
}
