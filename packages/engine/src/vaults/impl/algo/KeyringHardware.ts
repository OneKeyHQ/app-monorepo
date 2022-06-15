import { NotImplemented } from '../../../errors';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

export class KeyringHardware extends KeyringHardwareBase {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  signTransaction(unsignedTx: any, options: any): Promise<any> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  signMessage(messages: any, options: any): Promise<any> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prepareAccounts(params: any): Promise<any> {
    throw new NotImplemented();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getAddress(params: any): Promise<string> {
    throw new NotImplemented();
  }
}
