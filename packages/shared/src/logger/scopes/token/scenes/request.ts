import type {
  IFetchAccountTokensParams,
  IFetchTokenDetailParams,
} from '@onekeyhq/shared/types/token';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';
import { redactErrorMessageForLocalLog } from '../../../utils/redactErrorMessage';

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
  public fetchAccountTokensBlockedAllNetworkRequest({
    params,
  }: {
    params: IFetchAccountTokensParams & { mergeTokens?: boolean };
  }) {
    return [params];
  }

  // A balance fetch that only decorates a UI surface must not reject into a
  // fire-and-forget caller, but a failure still has to leave a trace: the
  // surface just renders without fiat values, which looks identical to an
  // account that holds nothing.
  @LogToLocal({ level: 'error' })
  public fetchAccountTokensFailed({
    errorMessage,
    errorName,
    flag,
    networkId,
  }: {
    errorMessage?: string;
    errorName?: string;
    flag: string;
    networkId?: string;
  }) {
    return [
      {
        errorMessage: redactErrorMessageForLocalLog(errorMessage),
        errorName,
        flag,
        networkId,
      },
    ];
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
