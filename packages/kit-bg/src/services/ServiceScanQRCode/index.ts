import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import ServiceBase from '../ServiceBase';

import { parseQRCode } from './utils/parseQRCode';

import type { IQRCodeHandlerParseOptions } from './utils/parseQRCode/type';

@backgroundClass()
class ServiceScanQRCode extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public parse(value: string, options?: IQRCodeHandlerParseOptions) {
    const getNetworkFromImplListAndChainId = memoizee(
      async (implList: string[], chainId: string) => {
        const { networks } =
          await this.backgroundApi.serviceNetwork.getNetworksByImpls({
            impls: implList,
          });
        return networks.find((n) => n.chainId === chainId);
      },
    );
    return parseQRCode(value, {
      ...options,
      getNetwork: getNetworkFromImplListAndChainId,
    });
  }
}

export default ServiceScanQRCode;
