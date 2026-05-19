import { resetAnimationQrcodeScan } from '@onekeyhq/kit-bg/src/services/ServiceScanQRCode/utils/parseQRCode/handlers/animation';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import {
  EQRCodeHandlerNames,
  EQRCodeHandlerType,
} from '@onekeyhq/shared/types/qrCode';

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
      handlers: options?.handlers ?? [],
      backgroundApi: this.backgroundApi,
    });
  }

  @backgroundMethod()
  public async resetAnimationData() {
    resetAnimationQrcodeScan();
  }

  /**
   * Parse a payment URI (e.g. from a third-party widget like Bitrefill) and
   * return structured data. The UI layer is responsible for opening the send
   * modal with this data. Only ethereum: URIs are supported in the current
   * minimal integration — callers should catch OneKeyError and surface a
   * user-facing message for unsupported schemes.
   */
  @backgroundMethod()
  public async handlePaymentUri({ uri }: { uri: string }) {
    if (!uri || typeof uri !== 'string') {
      throw new OneKeyError('Unsupported payment URI');
    }

    const result = await parseQRCode(uri, {
      handlers: [EQRCodeHandlerNames.ethereum],
      backgroundApi: this.backgroundApi,
    });

    if (result.type !== EQRCodeHandlerType.ETHEREUM) {
      throw new OneKeyError('Unsupported payment URI');
    }

    return result;
  }
}

export default ServiceScanQRCode;
