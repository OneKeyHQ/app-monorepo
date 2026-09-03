import type { ITokenFiat } from '@onekeyhq/shared/types/token';

// Placeholder fiat for a selector search row the account has no record for:
// backend keyword hits and aggregate sub rows on networks without an account.
// Receive does not require holdings, so such rows read as "0 held" instead of
// leaving the balance column blank next to the server-known `0 / $0.00` rows
// (OK-61367). `currency` is deliberately unset — a zero fiat value has
// nothing to convert. One frozen instance so the per-field selectors in
// `useTokenFiatField` see a stable reference across renders.
const ZERO_TOKEN_FIAT: ITokenFiat = Object.freeze({
  balance: '0',
  balanceParsed: '0',
  fiatValue: '0',
  price: 0,
});

// Non-cell fiat lookup for the TokenListView leaves: the per-row map first,
// then the flattened aggregate map, then (only when the host opted in) the
// zero placeholder above.
export function resolveMapTokenFiat({
  $key,
  tokenListMap,
  aggregateTokenFiatMap,
  zeroFillMissingFiat,
}: {
  $key: string;
  tokenListMap: Record<string, ITokenFiat> | undefined;
  aggregateTokenFiatMap: Record<string, ITokenFiat> | undefined;
  zeroFillMissingFiat: boolean;
}): ITokenFiat | undefined {
  const fiat = tokenListMap?.[$key] ?? aggregateTokenFiatMap?.[$key];
  if (fiat) {
    return fiat;
  }
  return zeroFillMissingFiat ? ZERO_TOKEN_FIAT : undefined;
}
