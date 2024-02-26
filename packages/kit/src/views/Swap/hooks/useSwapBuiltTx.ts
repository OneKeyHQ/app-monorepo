import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import type { IEncodedTx, ISignedTxPro } from '@onekeyhq/core/src/types';
import { EWrappedType } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useSendConfirm } from '../../../hooks/useSendConfirm';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapBuildTxFetchingAtom,
  useSwapFromTokenAmountAtom,
  useSwapQuoteCurrentSelectAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSlippagePercentageAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapReceiverAddress } from './useSwapReceiverAddress';
import { useSwapTxHistoryActions } from './useSwapTxHistory';

export function useSwapBuildTx() {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [slippagePercentage] = useSwapSlippagePercentageAtom();
  const [selectQuote] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const receiverAddress = useSwapReceiverAddress();
  const { generateSwapHistoryItem } = useSwapTxHistoryActions();
  const { navigationToSendConfirm } = useSendConfirm({
    accountId: activeAccount.account?.id ?? '',
    networkId: activeAccount.network?.id ?? '',
  });
  const handleBuildTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      console.log('txs-', txs);
      if (txs?.[0].txid && txs?.[0].swapInfo) {
        const txId = txs[0].txid;
        const netWorkFee = '999'; // todo
        await generateSwapHistoryItem({
          txId,
          netWorkFee,
          swapTxInfo: txs?.[0].swapInfo,
        });
      }
    },
    [generateSwapHistoryItem],
  );
  const handleWrappedTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      console.log('data-', data);
    },
    [],
  );
  const wrappedTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      fromTokenAmount &&
      selectQuote &&
      activeAccount.account?.address &&
      receiverAddress &&
      activeAccount.network?.id
    ) {
      setSwapBuildTxFetching(true);
      const wrappedType = fromToken.contractAddress
        ? EWrappedType.WITHDRAW
        : EWrappedType.DEPOSIT;
      const wrappedInfo: IWrappedInfo = {
        from: activeAccount.account?.address,
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
        accountAddress: activeAccount.account?.address,
        receivingAddress: receiverAddress,
        swapBuildResData: { result: selectQuote },
      };
      await navigationToSendConfirm({
        wrappedInfo,
        swapInfo,
        onSuccess: handleWrappedTxSuccess,
      });
      setSwapBuildTxFetching(false);
    }
  }, [
    activeAccount.account?.address,
    activeAccount.network?.id,
    fromToken,
    fromTokenAmount,
    handleWrappedTxSuccess,
    navigationToSendConfirm,
    receiverAddress,
    selectQuote,
    setSwapBuildTxFetching,
    toToken,
  ]);
  const approveTx = useCallback(
    async (amount: string, isMax?: boolean, onApproveSuccess?: () => void) => {
      const allowanceInfo = selectQuote?.allowanceResult;
      setSwapBuildTxFetching(true);
      if (
        allowanceInfo &&
        fromToken &&
        activeAccount.network?.id &&
        activeAccount.account?.id &&
        activeAccount.account?.address
      ) {
        const approveInfo: IApproveInfo = {
          owner: activeAccount.account.address,
          spender: allowanceInfo.allowanceTarget,
          amount,
          isMax,
          tokenInfo: {
            ...fromToken,
            address: fromToken.contractAddress,
            name: fromToken.name ?? fromToken.symbol,
          },
        };
        await navigationToSendConfirm({
          approveInfo,
          onSuccess: onApproveSuccess,
        });
        setSwapBuildTxFetching(false);
      }
    },
    [
      activeAccount.account?.address,
      activeAccount.account?.id,
      activeAccount.network?.id,
      fromToken,
      navigationToSendConfirm,
      selectQuote?.allowanceResult,
      setSwapBuildTxFetching,
    ],
  );

  const buildTx = useCallback(async () => {
    if (
      fromToken &&
      toToken &&
      fromTokenAmount &&
      slippagePercentage &&
      selectQuote &&
      activeAccount.account?.address &&
      receiverAddress &&
      activeAccount.network?.id
    ) {
      setSwapBuildTxFetching(true);
      const res = await backgroundApiProxy.serviceSwap.fetchBuildTx({
        fromToken,
        toToken,
        toTokenAmount: selectQuote.toAmount,
        fromTokenAmount,
        slippagePercentage: slippagePercentage.value,
        receivingAddress: receiverAddress,
        userAddress: activeAccount.account?.address,
        provider: selectQuote.info.provider,
      });
      if (!res) return;
      let transferInfo: ITransferInfo | undefined;
      let encodedTx: IEncodedTx | undefined;
      if (res?.swftOrder) {
        encodedTx = undefined;
        // swft order
        transferInfo = {
          from: activeAccount.account?.address,
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
          from: activeAccount.account?.address,
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
        accountAddress: activeAccount.account?.address,
        receivingAddress: receiverAddress,
        swapBuildResData: res,
      };

      await navigationToSendConfirm({
        transfersInfo: transferInfo ? [transferInfo] : undefined,
        encodedTx,
        swapInfo,
        onSuccess: handleBuildTxSuccess,
      });
      setSwapBuildTxFetching(false);
    }
  }, [
    activeAccount.account?.address,
    activeAccount.network?.id,
    fromToken,
    fromTokenAmount,
    handleBuildTxSuccess,
    navigationToSendConfirm,
    receiverAddress,
    selectQuote,
    setSwapBuildTxFetching,
    slippagePercentage,
    toToken,
  ]);

  return { buildTx, wrappedTx, approveTx };
}
