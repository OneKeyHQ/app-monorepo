import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EWrappedType } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useSendConfirm } from '../../../hooks/useSendConfirm';
import {
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePercentageAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapTxHistoryActions } from './useSwapTxHistory';

export function useSwapBuildTx() {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [{ slippageItem }] = useSwapSlippagePercentageAtom();
  const [selectQuote] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [, setInAppNotificationAtom] = useInAppNotificationAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const { generateSwapHistoryItem } = useSwapTxHistoryActions();
  const { navigationToSendConfirm } = useSendConfirm({
    accountId: swapFromAddressInfo.accountInfo?.account?.id ?? '',
    networkId: swapFromAddressInfo.networkId ?? '',
  });
  const handleBuildTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        setSwapFromTokenAmount(''); // send success, clear from token amount
        const transactionSignedInfo = data[0].signedTx;
        const transactionDecodedInfo = data[0].decodedTx;
        const txId = transactionSignedInfo.txid;
        const { swapInfo } = transactionSignedInfo;
        const { totalFeeInNative, totalFeeFiatValue } = transactionDecodedInfo;
        if (swapInfo) {
          await generateSwapHistoryItem({
            txId,
            gasFeeFiatValue: totalFeeFiatValue,
            gasFeeInNative: totalFeeInNative,
            swapTxInfo: swapInfo,
          });
        }
      }
      setSwapBuildTxFetching(false);
    },
    [generateSwapHistoryItem, setSwapBuildTxFetching, setSwapFromTokenAmount],
  );

  const handleApproveTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        const transactionSignedInfo = data[0].signedTx;
        const txId = transactionSignedInfo.txid;
        setInAppNotificationAtom((prev) => {
          if (prev.swapApprovingTransaction) {
            return {
              ...prev,
              swapApprovingTransaction: {
                ...prev.swapApprovingTransaction,
                txId,
              },
            };
          }
          return prev;
        });
      }
    },
    [setInAppNotificationAtom],
  );

  const handleTxFail = useCallback(() => {
    setSwapBuildTxFetching(false);
  }, [setSwapBuildTxFetching]);

  const cancelApproveTx = useCallback(() => {
    handleTxFail();
    setInAppNotificationAtom((prev) => {
      if (prev.swapApprovingTransaction) {
        return {
          ...prev,
          swapApprovingTransaction: {
            ...prev.swapApprovingTransaction,
            status: ESwapApproveTransactionStatus.CANCEL,
          },
        };
      }
      return prev;
    });
  }, [handleTxFail, setInAppNotificationAtom]);

  const wrappedTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      selectQuote?.fromAmount &&
      selectQuote?.toAmount &&
      swapFromAddressInfo.address &&
      swapToAddressInfo.address &&
      swapFromAddressInfo.networkId
    ) {
      setSwapBuildTxFetching(true);
      const wrappedType = fromToken.isNative
        ? EWrappedType.DEPOSIT
        : EWrappedType.WITHDRAW;
      const wrappedInfo: IWrappedInfo = {
        from: swapFromAddressInfo.address,
        type: wrappedType,
        contract:
          wrappedType === EWrappedType.WITHDRAW
            ? fromToken.contractAddress
            : toToken.contractAddress,
        amount: selectQuote?.fromAmount,
      };
      const swapInfo = {
        sender: {
          amount: selectQuote?.fromAmount,
          token: fromToken,
        },
        receiver: {
          amount: selectQuote.toAmount,
          token: toToken,
        },
        accountAddress: swapFromAddressInfo.address,
        receivingAddress: swapToAddressInfo.address,
        swapBuildResData: { result: selectQuote },
      };
      await navigationToSendConfirm({
        wrappedInfo,
        swapInfo,
        onSuccess: handleBuildTxSuccess,
        onFail: handleTxFail,
        onCancel: handleTxFail,
      });
    }
  }, [
    fromToken,
    toToken,
    selectQuote,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapToAddressInfo.address,
    setSwapBuildTxFetching,
    navigationToSendConfirm,
    handleBuildTxSuccess,
    handleTxFail,
  ]);

  const approveTx = useCallback(
    async (amount: string, isMax?: boolean, resetApproveValue?: string) => {
      const allowanceInfo = selectQuote?.allowanceResult;
      if (
        allowanceInfo &&
        fromToken &&
        toToken &&
        swapFromAddressInfo.networkId &&
        swapFromAddressInfo.accountInfo?.account?.id &&
        swapFromAddressInfo.address
      ) {
        try {
          setSwapBuildTxFetching(true);
          const approveInfo: IApproveInfo = {
            owner: swapFromAddressInfo.address,
            spender: allowanceInfo.allowanceTarget,
            amount,
            isMax: resetApproveValue ? false : isMax,
            tokenInfo: {
              ...fromToken,
              isNative: !!fromToken.isNative,
              address: fromToken.contractAddress,
              name: fromToken.name ?? fromToken.symbol,
            },
          };
          setInAppNotificationAtom((pre) => ({
            ...pre,
            swapApprovingTransaction: {
              provider: selectQuote?.info.provider,
              fromToken,
              toToken,
              amount,
              useAddress: swapFromAddressInfo.address ?? '',
              spenderAddress: allowanceInfo.allowanceTarget,
              status: ESwapApproveTransactionStatus.PENDING,
              resetApproveValue,
              resetApproveIsMax: isMax,
            },
          }));
          await navigationToSendConfirm({
            approveInfo,
            onSuccess: handleApproveTxSuccess,
            onFail: cancelApproveTx,
            onCancel: cancelApproveTx,
          });
        } catch (e) {
          setSwapBuildTxFetching(false);
        }
      }
    },
    [
      selectQuote?.allowanceResult,
      selectQuote?.info.provider,
      fromToken,
      toToken,
      swapFromAddressInfo.networkId,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapFromAddressInfo.address,
      setSwapBuildTxFetching,
      setInAppNotificationAtom,
      navigationToSendConfirm,
      handleApproveTxSuccess,
      cancelApproveTx,
    ],
  );

  const buildTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      selectQuote?.fromAmount &&
      slippageItem &&
      selectQuote?.toAmount &&
      swapFromAddressInfo.address &&
      swapToAddressInfo.address &&
      swapFromAddressInfo.networkId
    ) {
      try {
        setSwapBuildTxFetching(true);
        const res = await backgroundApiProxy.serviceSwap.fetchBuildTx({
          fromToken,
          toToken,
          toTokenAmount: selectQuote.toAmount,
          fromTokenAmount: selectQuote.fromAmount,
          slippagePercentage: slippageItem.value,
          receivingAddress: swapToAddressInfo.address,
          userAddress: swapFromAddressInfo.address,
          provider: selectQuote?.info.provider,
          accountId: swapFromAddressInfo.accountInfo?.account?.id,
          quoteResultCtx: selectQuote?.quoteResultCtx,
        });
        if (res) {
          let transferInfo: ITransferInfo | undefined;
          let encodedTx: IEncodedTx | undefined;
          if (res?.swftOrder) {
            encodedTx = undefined;
            // swft order
            transferInfo = {
              from: swapFromAddressInfo.address,
              tokenInfo: {
                ...res.result.fromTokenInfo,
                isNative: !!res.result.fromTokenInfo.isNative,
                address: res.result.fromTokenInfo.contractAddress,
                name:
                  res.result.fromTokenInfo.name ??
                  res.result.fromTokenInfo.symbol,
              },
              to: res.swftOrder.platformAddr,
              amount: res.swftOrder.depositCoinAmt,
            };
          }
          if (res?.thorSwapCallData) {
            encodedTx = undefined;
            transferInfo = {
              from: swapFromAddressInfo.address,
              tokenInfo: {
                ...res.result.fromTokenInfo,
                isNative: !!res.result.fromTokenInfo.isNative,
                address: res.result.fromTokenInfo.contractAddress,
                name:
                  res.result.fromTokenInfo.name ??
                  res.result.fromTokenInfo.symbol,
              },
              to: res.thorSwapCallData.vault,
              opReturn: res.thorSwapCallData.hasStreamingSwap
                ? res.thorSwapCallData.memoStreamingSwap
                : res.thorSwapCallData.memo,
              amount: new BigNumber(res.thorSwapCallData.amount)
                .shiftedBy(-fromToken.decimals)
                .toFixed(),
            };
          }
          if (res?.tx) {
            transferInfo = undefined;
            if (typeof res.tx !== 'string' && res.tx.data) {
              const valueHex = toBigIntHex(new BigNumber(res.tx.value ?? 0));
              encodedTx = {
                ...res?.tx,
                value: valueHex,
                from: swapFromAddressInfo.address,
              };
            } else {
              encodedTx = res.tx as string;
            }
          }
          const swapInfo = {
            sender: {
              amount: selectQuote.fromAmount,
              token: fromToken,
            },
            receiver: {
              amount: selectQuote.toAmount,
              token: toToken,
            },
            accountAddress: swapFromAddressInfo.address,
            receivingAddress: swapToAddressInfo.address,
            swapBuildResData: res,
          };
          await navigationToSendConfirm({
            transfersInfo: transferInfo ? [transferInfo] : undefined,
            encodedTx,
            swapInfo,
            onSuccess: handleBuildTxSuccess,
            onFail: handleTxFail,
            onCancel: handleTxFail,
          });
        } else {
          setSwapBuildTxFetching(false);
        }
      } catch (e) {
        setSwapBuildTxFetching(false);
      }
    }
  }, [
    fromToken,
    toToken,
    selectQuote?.fromAmount,
    selectQuote?.toAmount,
    selectQuote?.info.provider,
    selectQuote?.quoteResultCtx,
    slippageItem,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapFromAddressInfo.accountInfo?.account?.id,
    swapToAddressInfo.address,
    setSwapBuildTxFetching,
    navigationToSendConfirm,
    handleBuildTxSuccess,
    handleTxFail,
  ]);

  return { buildTx, wrappedTx, approveTx };
}
