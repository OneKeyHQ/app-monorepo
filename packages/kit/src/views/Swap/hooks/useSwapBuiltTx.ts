import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { Dialog } from '@onekeyhq/components';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { EWrappedType } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapBuildTxFetchingAtom,
  useSwapBuildTxResultAtom,
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
  const [, setSwapBuildTxResult] = useSwapBuildTxResultAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const receiverAddress = useSwapReceiverAddress();
  const { generateSwapHistoryItem } = useSwapTxHistoryActions();
  const handleBuildTxSuccess = useCallback(
    async (txs: ISignedTxPro[]) => {
      if (txs?.[0].txid) {
        const txId = txs[0].txid;
        const netWorkFee = '999';
        await generateSwapHistoryItem({ txId, netWorkFee });
      }
    },
    [generateSwapHistoryItem],
  );
  const handleApproveTxSuccess = useCallback(async (txs: ISignedTxPro[]) => {},
  []);
  const handleWrappedTxSuccess = useCallback(async (txs: ISignedTxPro[]) => {
    console.log('txs-', txs);
  }, []);
  const wrappedTx = useCallback(async () => {
    // todo wrapped tx  need vault add fn
    if (
      fromToken &&
      toToken &&
      fromTokenAmount &&
      selectQuote &&
      activeAccount.account?.address &&
      receiverAddress &&
      activeAccount.network?.id
    ) {
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
      const unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx({
        networkId: activeAccount.network?.id,
        accountId: activeAccount.account?.id,
        wrappedInfo,
      });
      return {
        unsignedTx,
        networkId: activeAccount.network?.id,
        accountId: activeAccount.account?.id,
        onSuccess: handleWrappedTxSuccess,
      };
    }
    return {};
  }, [
    activeAccount.account?.address,
    activeAccount.account?.id,
    activeAccount.network?.id,
    fromToken,
    fromTokenAmount,
    handleWrappedTxSuccess,
    receiverAddress,
    selectQuote,
    toToken,
  ]);
  const approveTx = useCallback(
    async (amount: string) => {
      const allowanceInfo = selectQuote?.allowanceResult;
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
          tokenInfo: {
            ...fromToken,
            address: fromToken.contractAddress,
            name: fromToken.name ?? fromToken.symbol,
          },
        };
        const unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx(
          {
            networkId: activeAccount.network?.id,
            accountId: activeAccount.account?.id,
            approveInfo,
          },
        );
        return {
          unsignedTx,
          networkId: activeAccount.network?.id,
          accountId: activeAccount.account?.id,
          onSuccess: handleApproveTxSuccess,
        };
      }
      return {};
    },
    [
      activeAccount.account?.address,
      activeAccount.account?.id,
      activeAccount.network?.id,
      fromToken,
      handleApproveTxSuccess,
      selectQuote?.allowanceResult,
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
      let unsignedTx;
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
      if (res?.swftOrder) {
        // swft order
        const transferInfo: ITransferInfo = {
          from: activeAccount.account?.address,
          tokenInfo: {
            ...fromToken,
            address: fromToken.contractAddress,
            name: fromToken.name ?? fromToken.symbol,
          },
          to: res.swftOrder.platformAddr,
          amount: res.swftOrder.depositCoinAmt,
        };
        unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx({
          transfersInfo: [transferInfo],
          networkId: activeAccount.network?.id,
          accountId: activeAccount.account?.id,
        });
      }
      if (res?.tx) {
        const valueHex = toBigIntHex(new BigNumber(res.tx.value));
        unsignedTx = {
          encodedTx: {
            ...res?.tx,
            value: valueHex,
            from: activeAccount.account?.address,
          },
        };
      }
      setSwapBuildTxResult(res);
      setSwapBuildTxFetching(false);
      return {
        unsignedTx,
        networkId: activeAccount.network?.id,
        accountId: activeAccount.account?.id,
        onSuccess: handleBuildTxSuccess,
      };
    }
    return {};
  }, [
    activeAccount.account?.address,
    activeAccount.account?.id,
    activeAccount.network?.id,
    fromToken,
    fromTokenAmount,
    handleBuildTxSuccess,
    receiverAddress,
    selectQuote,
    setSwapBuildTxFetching,
    setSwapBuildTxResult,
    slippagePercentage,
    toToken,
  ]);

  return { buildTx, wrappedTx, approveTx };
}
