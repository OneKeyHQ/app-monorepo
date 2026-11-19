import type {
  IFiatCryptoToken,
  IGetTokensListParams,
} from '@onekeyhq/shared/types/fiatCrypto';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class RequestScene extends BaseScene {
  @LogToLocal()
  public getTokensList({
    params,
    result,
  }: {
    params: IGetTokensListParams;
    result: IFiatCryptoToken[];
  }) {
    return [params, result.length];
  }

  // Background-side view of the Onramper session mint (the UI logs the same
  // round trip from its side, this one carries the HTTP status).
  @LogToLocal()
  public onramperSessionMinted(params: {
    durationMs: number;
    expiresAt?: string;
  }) {
    return params;
  }

  @LogToLocal({ level: 'error' })
  public onramperSessionMintFailed(params: {
    durationMs: number;
    status?: number;
    message?: string;
  }) {
    return params;
  }
}
