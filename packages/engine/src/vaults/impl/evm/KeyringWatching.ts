import { SignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { OneKeyInternalError } from '../../../errors';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

export class KeyringWatching extends KeyringWatchingBase {
  signTransaction(): Promise<SignedTx> {
    // throw new OneKeyInternalError('Watching account can not signTransaction');
    return Promise.resolve({
      txid: '1111',
      rawTx: '999999999999999999999',
    });
  }
}
