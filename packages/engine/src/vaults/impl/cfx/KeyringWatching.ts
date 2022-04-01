import { OneKeyInternalError } from '../../../errors';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

export class KeyringWatching extends KeyringWatchingBase {
  signTransaction(): Promise<any> {
    throw new OneKeyInternalError('Watching account can not signTransaction');
  }
}
