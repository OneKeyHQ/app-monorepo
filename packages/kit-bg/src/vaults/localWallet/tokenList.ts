import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { isEmpty } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IFetchServerTokenListResponse } from '@onekeyhq/shared/types/serverToken';
import type {
  IToken,
  ITokenData,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

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

export type IBackendTokenComposedBalance = {
  /** Composed total in base units (empty string if unknown). */
  total: string;
  /** Optional frozen portion in base units (e.g. pending shielded notes). */
  frozen?: string;
  /** Optional decimals override; defaults to the token's own decimals. */
  decimals?: number;
};

type ITokenListGroupKey = 'tokens' | 'smallBalanceTokens' | 'riskTokens';

/**
 * Overlays locally composed (public + private) balances onto a backend token
 * list response, recounting each affected group's `fiatValue` and refreshing
 * its `keys` fingerprint so UI caches update cleanly.
 *
 * Shared across privacy-capable chains (e.g. Zcash native balance, Starknet
 * STRK20 ERC-20 balances).
 */
export function applyComposedBalancesToBackendTokenList({
  response,
  resolveBalance,
  groups = ['tokens'],
}: {
  response: IFetchServerTokenListResponse;
  resolveBalance: (
    token: IToken,
    currentFiat: ITokenFiat,
  ) => IBackendTokenComposedBalance | undefined;
  groups?: ITokenListGroupKey[];
}): boolean {
  let updatedAny = false;
  for (const groupName of groups) {
    const group = response.data.data[groupName];
    if (group) {
      const fingerprintParts: string[] = [];
      for (const token of group.data) {
        const currentFiat = group.map[token.$key];
        const overlay = currentFiat
          ? resolveBalance(token, currentFiat)
          : undefined;
        if (currentFiat && overlay) {
          const decimals = overlay.decimals ?? token.decimals;
          const totalBn = new BigNumber(overlay.total);
          const balanceParsed = totalBn.isFinite()
            ? totalBn.shiftedBy(-decimals).toFixed()
            : '';
          const price = currentFiat.price || 0;
          const fiatValue =
            balanceParsed !== ''
              ? new BigNumber(balanceParsed).multipliedBy(price).toFixed()
              : '';
          // The group total feeds cached account worth: recount it from the
          // composed row value rather than leaving the public-only figure behind.
          const prevFiat = new BigNumber(currentFiat.fiatValue || 0);
          const groupFiat = new BigNumber(group.fiatValue || 0);
          if (fiatValue !== '' && prevFiat.isFinite() && groupFiat.isFinite()) {
            group.fiatValue = groupFiat
              .minus(prevFiat)
              .plus(fiatValue)
              .toFixed();
          }
          const nextEntry: ITokenFiat = {
            ...currentFiat,
            balance: overlay.total,
            balanceParsed,
            totalBalance: overlay.total,
            totalBalanceParsed: balanceParsed,
            fiatValue,
            totalBalanceFiatValue: fiatValue,
          };
          if (overlay.frozen !== undefined) {
            const frozenBn = new BigNumber(overlay.frozen);
            const frozenBalanceParsed = frozenBn.isFinite()
              ? frozenBn.shiftedBy(-decimals).toFixed()
              : '';
            nextEntry.frozenBalance = overlay.frozen;
            nextEntry.frozenBalanceParsed = frozenBalanceParsed;
            nextEntry.frozenBalanceFiatValue =
              frozenBalanceParsed !== ''
                ? new BigNumber(frozenBalanceParsed)
                    .multipliedBy(price)
                    .toFixed()
                : '';
          }
          group.map[token.$key] = nextEntry;
          fingerprintParts.push(
            `${token.$key}_${overlay.total}_${overlay.frozen ?? ''}`,
          );
          updatedAny = true;
        }
      }
      if (fingerprintParts.length > 0) {
        group.keys = md5(`${group.keys}_${fingerprintParts.join('_')}`);
      }
    }
  }
  return updatedAny;
}
