import { OneKeyInternalError } from '../../../errors';
import { KeyringWatchingBase } from '../../keyring/KeyringWatchingBase';

// @ts-ignore
export class KeyringWatching extends KeyringWatchingBase {
  signTransaction(): Promise<any> {
    throw new OneKeyInternalError('Watching account can not signTransaction');
  }
}
