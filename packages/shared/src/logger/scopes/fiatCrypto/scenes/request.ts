import type { IToken } from '@onekeyhq/shared/types/token';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';
import type {
  IGetTokensListParams,
  IFiatCryptoToken,
} from '@onekeyhq/shared/types/fiatCrypto';


export class RequestScene extends BaseScene {

  @LogToLocal()
  public getTokensList({
    params,
    result
  }: {
    params: IGetTokensListParams;
    result: IFiatCryptoToken[];
  }) {
    return [params, result.length];
  }
}
