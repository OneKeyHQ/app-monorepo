import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { EWrappedType } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useSendConfirm } from '../../../hooks/useSendConfirm';
import {
  useSwapApprovingTransactionAtom,
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
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [slippagePercentage] = useSwapSlippagePercentageAtom();
  const [selectQuote] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [, setSwapApprovingTransaction] = useSwapApprovingTransactionAtom();
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
        setSwapApprovingTransaction((prev) => {
          if (prev) {
            return { ...prev, txId };
          }
        });
      }
    },
    [setSwapApprovingTransaction],
  );

  const handleWrappedTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        setSwapFromTokenAmount('');
      }
      setSwapBuildTxFetching(false);
    },
    [setSwapBuildTxFetching, setSwapFromTokenAmount],
  );

  const handleTxFail = useCallback(() => {
    setSwapBuildTxFetching(false);
  }, [setSwapBuildTxFetching]);

  const cancelApproveTx = useCallback(() => {
    handleTxFail();
    setSwapApprovingTransaction(undefined);
  }, [handleTxFail, setSwapApprovingTransaction]);

  const wrappedTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      fromTokenAmount &&
      selectQuote?.toAmount &&
      swapFromAddressInfo.address &&
      swapToAddressInfo.address &&
      swapFromAddressInfo.networkId
    ) {
      setSwapBuildTxFetching(true);
      const wrappedType = fromToken.isNative
        ? EWrappedType.WITHDRAW
        : EWrappedType.DEPOSIT;
      const wrappedInfo: IWrappedInfo = {
        from: swapFromAddressInfo.address,
        type: wrappedType,
        contract:
          wrappedType === EWrappedType.WITHDRAW
            ? fromToken.contractAddress
            : toToken.contractAddress,
        amount: fromTokenAmount,
      };
      const swapInfo = {
        sender: {
          amount: fromTokenAmount,
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
        onSuccess: handleWrappedTxSuccess,
        onFail: handleTxFail,
        onCancel: handleTxFail,
      });
    }
  }, [
    fromToken,
    toToken,
    fromTokenAmount,
    selectQuote,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapToAddressInfo.address,
    setSwapBuildTxFetching,
    navigationToSendConfirm,
    handleWrappedTxSuccess,
    handleTxFail,
  ]);

  const approveTx = useCallback(
    async (amount: string, isMax?: boolean, onApproveSuccess?: () => void) => {
      const allowanceInfo = selectQuote?.allowanceResult;
      if (
        allowanceInfo &&
        fromToken &&
        toToken &&
        swapFromAddressInfo.networkId &&
        swapFromAddressInfo.accountInfo?.account?.id &&
        swapFromAddressInfo.address
      ) {
        setSwapBuildTxFetching(true);
        const approveInfo: IApproveInfo = {
          owner: swapFromAddressInfo.address,
          spender: allowanceInfo.allowanceTarget,
          amount,
          isMax,
          tokenInfo: {
            ...fromToken,
            address: fromToken.contractAddress,
            name: fromToken.name ?? fromToken.symbol,
          },
        };
        if (!onApproveSuccess) {
          setSwapApprovingTransaction({
            provider: selectQuote.info.provider,
            fromToken,
            toToken,
            amount,
            useAddress: swapFromAddressInfo.address,
            spenderAddress: allowanceInfo.allowanceTarget,
          });
        }
        await navigationToSendConfirm({
          approveInfo,
          onSuccess: onApproveSuccess || handleApproveTxSuccess,
          onFail: cancelApproveTx,
          onCancel: cancelApproveTx,
        });
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
      navigationToSendConfirm,
      handleApproveTxSuccess,
      cancelApproveTx,
      setSwapApprovingTransaction,
    ],
  );

  const buildTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      fromTokenAmount &&
      slippagePercentage &&
      selectQuote?.toAmount &&
      swapFromAddressInfo.address &&
      swapToAddressInfo.address &&
      swapFromAddressInfo.networkId
    ) {
      setSwapBuildTxFetching(true);
      const res = await backgroundApiProxy.serviceSwap.fetchBuildTx({
        fromToken,
        toToken,
        toTokenAmount: selectQuote.toAmount,
        fromTokenAmount,
        slippagePercentage: slippagePercentage.value,
        receivingAddress: swapToAddressInfo.address,
        userAddress: swapFromAddressInfo.address,
        provider: selectQuote.info.provider,
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
              ...fromToken,
              address: fromToken.contractAddress,
              name: fromToken.name ?? fromToken.symbol,
            },
            to: res.swftOrder.platformAddr,
            amount: res.swftOrder.depositCoinAmt,
          };
        }
        if (res?.tx) {
          transferInfo = undefined;
          const valueHex = toBigIntHex(new BigNumber(res.tx.value));
          encodedTx = {
            ...res?.tx,
            value: valueHex,
            from: swapFromAddressInfo.address,
          };
        }
        const swapInfo = {
          sender: {
            amount: fromTokenAmount,
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
    }
  }, [
    fromToken,
    toToken,
    fromTokenAmount,
    slippagePercentage,
    selectQuote,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapToAddressInfo.address,
    setSwapBuildTxFetching,
    navigationToSendConfirm,
    handleBuildTxSuccess,
    handleTxFail,
  ]);

  return { buildTx, wrappedTx, approveTx };
}
