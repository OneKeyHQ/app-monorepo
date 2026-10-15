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
 * A native-token list synthesized from a locally scanned balance.
 *
 * ## Why this exists
 *
 * The token list normally comes from the backend index. A client-scanned
 * privacy chain either has no backend at all (Monero: `backendIndex: false`)
 * or has one that cannot see the shielded half (Zcash). Without a synthesized
 * response the account page has no native token row — which reads to the user
 * as "this wallet holds nothing", not as "we could not ask".
 *
 * Shared rather than written per chain because the shape is a backend contract,
 * not a chain fact: `$key` has to match how the rest of the app keys token
 * fiat, and `keys` has to change whenever the content does or the UI caches a
 * stale row forever. Both are easy to get subtly wrong once, let alone twice.
 *
 * ## No price
 *
 * `price: 0` is not a claim that the coin is worthless — it is the absence of a
 * quote. The fiat value is left blank rather than computed as zero, because a
 * confident "$0.00" next to a real balance is worse than no number.
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
