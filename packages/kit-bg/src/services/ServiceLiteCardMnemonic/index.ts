import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from '../ServiceBase';

import { decodeMnemonic, encodeMnemonic } from './utils/liteCardMnemonic';

@backgroundClass()
class ServiceLiteCardMnemonic extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async encodeMnemonic(mnemonic: string): Promise<string> {
    return encodeMnemonic(mnemonic);
  }

  @backgroundMethod()
  async decodeMnemonic(payload: string) {
    return decodeMnemonic(payload);
  }
}

export default ServiceLiteCardMnemonic;
