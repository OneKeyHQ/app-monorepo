import type {
  IFetchAccountTokensParams,
  IFetchTokenDetailParams,
} from '@onekeyhq/shared/types/token';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';
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

  // The response listed rows whose $key has no fiat entry in the same group's
  // map. Home shows those rows with a "--" price and an empty balance / value
  // column (OK-66042); the client cannot synthesize the fiat, so record which
  // network / groups the server left unpriced. $keys carry the account
  // address and token symbols are untrusted metadata, so the server payload
  // carries only counts; fetchAccountTokensMapMissingSymbols keeps the
  // symbols on the device.
  @LogToServer()
  @LogToLocal({ level: 'warn' })
  public fetchAccountTokensMapMissingKeys({
    networkId,
    flag,
    missingCount,
    groups,
  }: {
    networkId?: string;
    flag: string;
    missingCount: number;
    groups: Record<string, number>;
  }) {
    return [{ networkId, flag, missingCount, groups }];
  }

  // Device-log companion of fetchAccountTokensMapMissingKeys: the symbols
  // identify the unpriced rows in a log export but never leave the device.
  @LogToLocal({ level: 'warn' })
  public fetchAccountTokensMapMissingSymbols({
    networkId,
    flag,
    symbols,
  }: {
    networkId?: string;
    flag: string;
    symbols: string[];
  }) {
    return [{ networkId, flag, symbols }];
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
