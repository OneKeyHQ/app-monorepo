import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from '../ServiceBase';

import { parseQRCode } from './parseQRCode';

import type { IQRCodeHandlerParseOptions } from './parseQRCode/type';

@backgroundClass()
class ServiceUrlParse extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public parse(value: string, options?: IQRCodeHandlerParseOptions) {
    return parseQRCode(value, options);
  }
}

export default ServiceUrlParse;
