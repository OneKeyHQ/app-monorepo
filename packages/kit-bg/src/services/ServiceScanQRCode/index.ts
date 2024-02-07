import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

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
    return parseQRCode(value, {
      ...options,
      getNetwork: (implsList, chainId) =>
        this.backgroundApi.serviceNetwork.getNetworkByImplListAndChainId(
          implsList,
          chainId,
        ),
    });
  }
}

export default ServiceScanQRCode;
