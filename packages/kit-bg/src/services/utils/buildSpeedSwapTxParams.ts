import type {
  EProtocolOfExchange,
  ESwapQuoteKind,
  IFetchBuildTxParams,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

export function buildSpeedSwapTxParams({
  fromToken,
  toToken,
  fromTokenAmount,
  userAddress,
  provider,
  receivingAddress,
  slippagePercentage,
  protocol,
  kind,
  walletType,
  quoteResultCtx,
}: {
  fromToken: ISwapToken;
  toToken: ISwapToken;
  fromTokenAmount: string;
  userAddress: string;
  provider: string;
  receivingAddress: string;
  slippagePercentage: number;
  protocol: EProtocolOfExchange;
  kind: ESwapQuoteKind;
  walletType?: string;
  quoteResultCtx?: IFetchBuildTxParams['quoteResultCtx'];
}): IFetchBuildTxParams {
  return {
    fromTokenAddress: fromToken.contractAddress,
    toTokenAddress: toToken.contractAddress,
    fromTokenAmount,
    fromNetworkId: fromToken.networkId,
    toNetworkId: toToken.networkId,
    protocol,
    provider,
    userAddress,
    receivingAddress,
    slippagePercentage,
    kind,
    walletType,
    quoteResultCtx,
  };
}
