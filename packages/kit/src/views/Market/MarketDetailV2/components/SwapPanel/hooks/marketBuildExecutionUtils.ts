import BigNumber from 'bignumber.js';

import type { EAddressEncodings, IEncodedTx } from '@onekeyhq/core/src/types';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  EInternalDappEnum,
  type IStakeTx,
} from '@onekeyhq/shared/types/staking';
import type {
  IFetchBuildTxResponse,
  ISwapToken,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

function buildTransferTokenInfo(
  token: IFetchBuildTxResponse['result']['fromTokenInfo'],
) {
  return {
    ...token,
    isNative: !!token.isNative,
    address: token.contractAddress,
    name: token.name ?? token.symbol,
  };
}

export async function buildMarketExecutionPayload({
  accountId,
  buildRes,
  btcDerivationRestrictionErrorMessage,
  currentFromToken,
  currentToToken,
  deriveAddressEncoding,
  fromAmount,
  receivingAddress,
  slippage,
  swapType,
  userAddress,
  onBuildInternalDappTx,
  onBuildLMSwapEncodedTx,
  onBuildOkxSwapEncodedTx,
}: {
  accountId: string;
  buildRes: IFetchBuildTxResponse;
  btcDerivationRestrictionErrorMessage?: string;
  currentFromToken: ISwapToken;
  currentToToken: ISwapToken;
  deriveAddressEncoding?: EAddressEncodings | string;
  fromAmount: string;
  receivingAddress: string;
  slippage: number;
  swapType?: ESwapTabSwitchType;
  userAddress: string;
  onBuildInternalDappTx: (params: {
    accountId: string;
    networkId: string;
    tx: IStakeTx;
    internalDappType: EInternalDappEnum;
  }) => Promise<IEncodedTx>;
  onBuildLMSwapEncodedTx: (params: {
    accountId: string;
    networkId: string;
    lmTx: NonNullable<IFetchBuildTxResponse['LMTronObject']>;
  }) => Promise<IEncodedTx>;
  onBuildOkxSwapEncodedTx: (params: {
    accountId: string;
    networkId: string;
    okxTx: NonNullable<IFetchBuildTxResponse['OKXTxObject']>;
    fromTokenInfo: IFetchBuildTxResponse['result']['fromTokenInfo'];
    type: ESwapTabSwitchType;
  }) => Promise<IEncodedTx>;
}): Promise<{
  encodedTx?: IEncodedTx;
  transferInfo?: ITransferInfo;
  swapInfo: ISwapTxInfo;
  skipSendTransAction: boolean;
  orderId?: string;
}> {
  let transferInfo: ITransferInfo | undefined;
  let encodedTx: IEncodedTx | undefined;
  const serviceOrderId = buildRes.orderId ?? buildRes.result.quoteId;

  if (buildRes.swftOrder) {
    transferInfo = {
      from: userAddress,
      tokenInfo: buildTransferTokenInfo(buildRes.result.fromTokenInfo),
      to: buildRes.swftOrder.platformAddr,
      amount: buildRes.swftOrder.depositCoinAmt,
      memo: buildRes.swftOrder.memo,
    };
  } else if (buildRes.changellyOrder) {
    transferInfo = {
      from: userAddress,
      tokenInfo: buildTransferTokenInfo(buildRes.result.fromTokenInfo),
      to: buildRes.changellyOrder.payinAddress,
      amount: buildRes.changellyOrder.amountExpectedFrom,
      memo: buildRes.changellyOrder.payinExtraId,
    };
  } else if (buildRes.thorSwapCallData) {
    transferInfo = {
      from: userAddress,
      tokenInfo: buildTransferTokenInfo(buildRes.result.fromTokenInfo),
      to: buildRes.thorSwapCallData.vault,
      opReturn: buildRes.thorSwapCallData.hasStreamingSwap
        ? buildRes.thorSwapCallData.memoStreamingSwap
        : buildRes.thorSwapCallData.memo,
      amount: new BigNumber(buildRes.thorSwapCallData.amount)
        .shiftedBy(-buildRes.result.fromTokenInfo.decimals)
        .toFixed(),
    };
  } else if (buildRes.OKXTxObject) {
    encodedTx = await onBuildOkxSwapEncodedTx({
      accountId,
      networkId: currentFromToken.networkId,
      okxTx: buildRes.OKXTxObject,
      fromTokenInfo: buildRes.result.fromTokenInfo,
      type: swapType ?? ESwapTabSwitchType.SWAP,
    });
  } else if (buildRes.LMTronObject) {
    encodedTx = await onBuildLMSwapEncodedTx({
      accountId,
      networkId: currentFromToken.networkId,
      lmTx: buildRes.LMTronObject,
    });
  } else if (buildRes.tronTxData) {
    encodedTx = buildRes.tronTxData;
  } else if (buildRes.xrpTxData) {
    encodedTx = buildRes.xrpTxData;
  } else if (buildRes.tx) {
    if (typeof buildRes.tx !== 'string' && buildRes.tx.data) {
      encodedTx = {
        ...buildRes.tx,
        value: toBigIntHex(new BigNumber(buildRes.tx.value ?? 0)),
        from: userAddress,
      };
    } else {
      encodedTx = buildRes.tx as IEncodedTx;
    }
  } else if (buildRes.btcData || buildRes.suiBase64Data) {
    let inputTx: IStakeTx | undefined;

    if (buildRes.btcData) {
      if (
        !deriveAddressEncoding ||
        !buildRes.btcData.addressType.includes(deriveAddressEncoding)
      ) {
        throw new OneKeyLocalError(
          btcDerivationRestrictionErrorMessage ??
            'BTC derivation path restriction.',
        );
      }

      inputTx = {
        psbtHex: buildRes.btcData.hexStr,
      };
    }

    if (buildRes.suiBase64Data) {
      inputTx = buildRes.suiBase64Data;
    }

    if (inputTx) {
      encodedTx = await onBuildInternalDappTx({
        accountId,
        networkId: currentFromToken.networkId,
        tx: inputTx,
        internalDappType: EInternalDappEnum.Swap,
      });
    }
  }

  const swapInfo: ISwapTxInfo = {
    protocol: buildRes.result.protocol ?? EProtocolOfExchange.SWAP,
    sender: {
      amount: buildRes.result.fromAmount ?? fromAmount,
      token: currentFromToken,
      accountInfo: {
        accountId,
        networkId: currentFromToken.networkId,
      },
    },
    receiver: {
      amount: buildRes.result.toAmount ?? '',
      token: currentToToken,
      accountInfo: {
        accountId,
        networkId: currentToToken.networkId,
      },
    },
    accountAddress: userAddress,
    receivingAddress,
    swapBuildResData: {
      ...buildRes,
      orderId: serviceOrderId,
      result: {
        ...buildRes.result,
        slippage: buildRes.result.slippage ?? slippage,
      },
    },
  };

  return {
    encodedTx,
    transferInfo,
    swapInfo,
    skipSendTransAction: Boolean(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      buildRes.ctx?.cowSwapOrderId ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      buildRes.ctx?.oneInchFusionOrderHash ||
      buildRes.result.swapShouldSignedData,
    ),
    orderId: serviceOrderId,
  };
}
