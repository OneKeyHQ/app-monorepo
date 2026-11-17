import type { IMarketTokenBatchRequestParams } from '../../types/marketV2';

export type IMarketTokenBatchRequestItem =
  IMarketTokenBatchRequestParams['tokenAddressList'][number];

// `/utility/v2/market/token/list/batch` rejects unknown item fields with a 422
// (e.g. listing ids like `assetId`), so callers that pass richer token objects
// are reduced to the contract fields before the request goes out.
export function toMarketTokenBatchRequestItems(
  tokenAddressList: IMarketTokenBatchRequestItem[],
): IMarketTokenBatchRequestItem[] {
  return tokenAddressList.map(({ chainId, contractAddress, isNative }) => ({
    chainId,
    contractAddress,
    isNative,
  }));
}
