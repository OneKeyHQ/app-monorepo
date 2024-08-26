import type {
  IFiatCryptoToken,
  IGetTokensListParams,
} from '@onekeyhq/shared/types/fiatCrypto';
import type { IToken } from '@onekeyhq/shared/types/token';

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
}
