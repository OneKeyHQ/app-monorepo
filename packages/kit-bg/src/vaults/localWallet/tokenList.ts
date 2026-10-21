import { md5 } from 'js-md5';
import { isEmpty } from 'lodash';

import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IFetchServerTokenListResponse } from '@onekeyhq/shared/types/serverToken';
import type {
  IBalanceStatus,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

/**
 * A native-token list synthesized from a locally scanned balance, for chains
 * the backend index cannot fully see. `$key` must match how the app keys token
 * fiat, and `keys` must change with the content or the UI caches a stale row.
 * `price: 0` means no quote: fiat is left blank, not shown as $0.00.
 */
export function buildLocalWalletNativeTokenList(params: {
  network: IServerNetwork;
  networkId: string;
  accountAddress: string;
  xpub?: string;
  /** Smallest-unit string. `''` means "not known", not "zero". */
  balance: string;
  balanceParsed: string;
  balanceStatus?: IBalanceStatus;
}): IFetchServerTokenListResponse {
  const {
    network,
    networkId,
    accountAddress,
    xpub,
    balance,
    balanceParsed,
    balanceStatus,
  } = params;

  const key = `${networkId}_${xpub ?? accountAddress}_`;
  const map: Record<string, ITokenFiat> = {
    [key]: {
      price: 0,
      price24h: 0,
      balance,
      balanceParsed,
      balanceStatus,
      // Only a confirmed zero balance is worth 0; anything else is unknown.
      fiatValue: balance === '0' ? '0' : '',
    },
  };
  const data = [
    {
      '$key': key,
      'decimals': network.decimals,
      'name': network.name,
      'symbol': network.symbol,
      'address': '',
      'logoURI': network.logoURI,
      'isNative': true,
    },
  ];
  const tokens: ITokenData = {
    data,
    map,
    keys: md5(
      `${networkId}__${
        isEmpty(map) ? '' : Object.keys(map).join(',')
      }__${JSON.stringify(data)}`,
    ),
    fiatValue: undefined,
  };

  const emptyTokenData = (): ITokenData => ({
    data: [],
    map: {},
    keys: md5(`${networkId}__empty`),
    fiatValue: undefined,
  });

  return {
    data: {
      data: {
        tokens,
        riskTokens: emptyTokenData(),
        smallBalanceTokens: emptyTokenData(),
      },
    },
  };
}
