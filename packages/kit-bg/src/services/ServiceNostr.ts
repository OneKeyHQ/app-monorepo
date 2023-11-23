import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { setBoardingCompleted } from '@onekeyhq/kit/src/store/reducers/status';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceNostr extends ServiceBase {
  @backgroundMethod()
  async getPublicKey({
    walletId,
    password,
  }: {
    walletId: string;
    password: string;
  }) {
    console.log(password);
    return Promise.resolve('PUBKEY_FAKE');
  }
}
