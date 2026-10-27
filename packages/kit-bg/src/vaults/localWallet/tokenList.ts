import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty } from 'lodash';

import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IFetchServerTokenListResponse } from '@onekeyhq/shared/types/serverToken';
import type { ITokenData, ITokenFiat } from '@onekeyhq/shared/types/token';

/**
 * Fiat for a locally known amount. Only a confirmed zero is worth 0; an
 * unknown amount (`''`) or a missing quote is unknown (`''`), not $0.00.
 */
export function getLocalWalletFiatValue({
  amountParsed,
  price,
}: {
  amountParsed: string;
  price?: number;
}): string {
  const amount = new BigNumber(amountParsed);
  if (!amount.isFinite()) return '';
  if (amount.isZero()) return '0';
  return price === undefined ? '' : amount.multipliedBy(price).toFixed();
}

/**
 * A native-token list synthesized from a locally scanned balance, for chains
 * the backend index cannot fully see. `$key` must match how the app keys token
 * fiat, and `keys` must change with the content or the UI caches a stale row.
 * `price` is in the request currency; without it fiat is left blank.
 */
export function buildLocalWalletNativeTokenList(params: {
  network: IServerNetwork;
  networkId: string;
  accountAddress: string;
  xpub?: string;
  /** Smallest-unit string. `''` means "not known", not "zero". */
  balance: string;
  balanceParsed: string;
  price?: number;
}): IFetchServerTokenListResponse {
  const {
    network,
    networkId,
    accountAddress,
    xpub,
    balance,
    balanceParsed,
    price,
  } = params;

  const key = `${networkId}_${xpub ?? accountAddress}_`;
  const fiatValue = getLocalWalletFiatValue({
    amountParsed: balanceParsed,
    price,
  });
  const map: Record<string, ITokenFiat> = {
    [key]: {
      price: price ?? 0,
      price24h: 0,
      balance,
      balanceParsed,
      fiatValue,
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
    // The group total that cached account worth is read from.
    fiatValue: fiatValue || undefined,
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
