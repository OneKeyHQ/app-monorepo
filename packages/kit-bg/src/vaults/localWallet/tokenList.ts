import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IFetchServerTokenListResponse } from '@onekeyhq/shared/types/serverToken';
import type { ITokenData, ITokenFiat } from '@onekeyhq/shared/types/token';

/**
 * For a balance that cannot be read now. Thrown as a failed backend fetch is
 * on other chains, so pages keep the figure they show (or keep loading) and no
 * partial figure or zero reaches the token caches.
 */
export function localWalletBalanceUnavailableError(
  chain: string,
): OneKeyLocalError {
  return new OneKeyLocalError({
    message: `${chain}: balance unavailable`,
    autoToast: false,
  });
}

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

// An unpriced row carries the null price the backend sends for one, which
// readers show as "--" or treat with their zero fallback; the shared type
// still says number.
export function toLocalWalletTokenPrice(price: number | undefined): number {
  return price ?? (null as unknown as number);
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
  price24h?: number;
}): IFetchServerTokenListResponse {
  const {
    network,
    networkId,
    accountAddress,
    xpub,
    balance,
    balanceParsed,
    price,
    price24h,
  } = params;

  const key = `${networkId}_${xpub ?? accountAddress}_`;
  const fiatValue = getLocalWalletFiatValue({
    amountParsed: balanceParsed,
    price,
  });
  const map: Record<string, ITokenFiat> = {
    [key]: {
      price: toLocalWalletTokenPrice(price),
      price24h,
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
