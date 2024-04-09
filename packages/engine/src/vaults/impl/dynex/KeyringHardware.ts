import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type { DBAccount } from '../../../types/account';
import type {
  IHardwareGetAddressParams,
  IPrepareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  override prepareAccounts(
    params: IPrepareAccountsParams,
  ): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }

  override getAddress(params: IHardwareGetAddressParams): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(
    params: IHardwareGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }
}
