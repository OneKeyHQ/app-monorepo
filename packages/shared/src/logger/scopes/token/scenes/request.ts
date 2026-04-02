import type {
  IFetchAccountTokensParams,
  IFetchTokenDetailParams,
} from '@onekeyhq/shared/types/token';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class RequestScene extends BaseScene {
  @LogToLocal({ level: 'error' })
  public fetchAccountTokenAccountAddressAndXpubBothEmpty({
    params,
    accountAddress,
    xpub,
  }: {
    params: IFetchAccountTokensParams & { mergeTokens?: boolean };
    accountAddress?: string;
    xpub?: string;
  }) {
    return [params, accountAddress, xpub];
  }

  @LogToLocal({ level: 'error' })
  public fetchTokensDetailsAccountAddressAndXpubBothEmpty({
    params,
    accountAddress,
    xpub,
  }: {
    params: IFetchTokenDetailParams;
    accountAddress?: string;
    xpub?: string;
  }) {
    return [params, accountAddress, xpub];
  }
}
