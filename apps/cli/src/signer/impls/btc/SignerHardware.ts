import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { AppError, ERROR_CODES } from '../../../errors';

import type { IBtcSignerImpl } from './btc-path';
import type { ISignerHardwareConfig } from '../../base/SignerHardwareBase';
import type {
  ISignTransactionPayload,
  ISigner,
  ISignerGetAddressOptions,
} from '../../types';

export interface ISignerHardwareBtcConfig extends ISignerHardwareConfig {
  impl: IBtcSignerImpl;
}

export class SignerHardware implements ISigner {
  private readonly impl: IBtcSignerImpl;

  constructor(config: ISignerHardwareBtcConfig) {
    this.impl = config.impl;
  }

  async getAddress(
    _networkId: string,
    _options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem> {
    throw this.unsupported();
  }

  async signTransaction(
    _payload: ISignTransactionPayload,
  ): Promise<ISignedTxPro> {
    throw this.unsupported();
  }

  async signMessage(_payload: ICoreApiSignMsgPayload): Promise<string> {
    throw this.unsupported();
  }

  private unsupported(): AppError {
    return new AppError(
      ERROR_CODES.AUTH_SESSION_INVALID.code,
      `${this.impl.toUpperCase()} hardware signing is not supported yet.`,
      'Task 3 will add hardware SDK integration.',
    );
  }
}
