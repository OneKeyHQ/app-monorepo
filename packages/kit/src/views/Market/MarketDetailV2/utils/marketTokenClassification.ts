import type {
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

type IMarketStockTokenCandidate =
  | Pick<IMarketTokenDetail, 'stock'>
  | Pick<IMarketTokenDetailPreview, 'stock'>;

export function isMarketStockToken(
  ...tokens: (IMarketStockTokenCandidate | undefined)[]
) {
  return tokens.some((token) => Boolean(token?.stock));
}
