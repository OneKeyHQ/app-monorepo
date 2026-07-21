import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketPerpsInfo,
  IMarketStockInfo,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

export type ISwapTokenMarketDetailState = {
  unavailable: boolean;
  token?: IMarketTokenDetail;
  perpsInfo?: IMarketPerpsInfo;
};

export type ISwapPairClosedStock = {
  stock: IMarketStockInfo;
  perpsInfo?: IMarketPerpsInfo;
};

export type ISwapPairStockMarketStatus = {
  scope: string;
  hasStockToken: boolean;
  unavailable: boolean;
  closedStock?: ISwapPairClosedStock;
};

function getSwapTokenMarketStatusScope(token?: ISwapToken) {
  if (!token?.networkId) {
    return '';
  }

  const contractAddress = normalizeTokenContractAddress({
    networkId: token.networkId,
    contractAddress: token.contractAddress,
  });
  return `${token.networkId}:${
    token.isNative ? 'native' : (contractAddress ?? '')
  }`;
}

export function getSwapPairMarketStatusScope({
  swapTypeSwitch,
  fromToken,
  toToken,
}: {
  swapTypeSwitch: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  if (
    swapTypeSwitch !== ESwapTabSwitchType.SWAP &&
    swapTypeSwitch !== ESwapTabSwitchType.BRIDGE
  ) {
    return '';
  }
  const fromTokenScope = getSwapTokenMarketStatusScope(fromToken);
  const toTokenScope = getSwapTokenMarketStatusScope(toToken);
  if (!fromTokenScope || !toTokenScope) {
    return '';
  }

  return `swap-bridge:${fromTokenScope}->${toTokenScope}`;
}

export function resolveSwapPairStockMarketStatus({
  scope,
  fromTokenDetail,
  toTokenDetail,
}: {
  scope: string;
  fromTokenDetail: ISwapTokenMarketDetailState;
  toTokenDetail: ISwapTokenMarketDetailState;
}): ISwapPairStockMarketStatus {
  const tokenDetails = [fromTokenDetail, toTokenDetail];
  const stockTokenDetails = tokenDetails.filter((item) => item.token?.stock);
  const closedStockTokenDetail = stockTokenDetails.find(
    (item) => item.token?.stock?.isOpen === false,
  );

  return {
    scope,
    hasStockToken: stockTokenDetails.length > 0,
    unavailable: tokenDetails.some((item) => item.unavailable),
    closedStock: closedStockTokenDetail?.token?.stock
      ? {
          stock: closedStockTokenDetail.token.stock,
          perpsInfo: closedStockTokenDetail.perpsInfo,
        }
      : undefined,
  };
}

export function getCurrentSwapPairStockMarketStatus({
  scope,
  result,
}: {
  scope: string;
  result?: ISwapPairStockMarketStatus;
}) {
  if (!scope || result?.scope !== scope) {
    return undefined;
  }
  return result;
}

export function isSwapPairStockMarketClosed({
  status,
  swapTypeSwitch,
  fromToken,
  toToken,
}: {
  status?: ISwapPairStockMarketStatus;
  swapTypeSwitch: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  const scope = getSwapPairMarketStatusScope({
    swapTypeSwitch,
    fromToken,
    toToken,
  });
  return Boolean(
    getCurrentSwapPairStockMarketStatus({ scope, result: status })?.closedStock,
  );
}

export function shouldBlockSwapTradeSubmissionForMarketClosed({
  isMarketClosed,
  noConnectWallet,
  isRefreshQuote,
}: {
  isMarketClosed: boolean;
  noConnectWallet: boolean;
  isRefreshQuote: boolean;
}) {
  return isMarketClosed && !noConnectWallet && !isRefreshQuote;
}
