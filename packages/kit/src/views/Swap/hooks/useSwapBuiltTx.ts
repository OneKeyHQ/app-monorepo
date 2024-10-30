import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import { EPageType, usePageType } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EWrappedType } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import { swapApproveResetValue } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
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
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapSlippagePercentageAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapTxHistoryActions } from './useSwapTxHistory';

export function useSwapBuildTx() {
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [{ slippageItem }] = useSwapSlippagePercentageAtom();
  const [selectQuote] = useSwapQuoteCurrentSelectAtom();
  const [, setSwapQuoteResultList] = useSwapQuoteListAtom();
  const [, setSwapQuoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [, setSwapBuildTxFetching] = useSwapBuildTxFetchingAtom();
  const [inAppNotificationAtom, setInAppNotificationAtom] =
    useInAppNotificationAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [, setSwapFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setSwapShouldRefreshQuote] = useSwapShouldRefreshQuoteAtom();
  const swapFromAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const { generateSwapHistoryItem } = useSwapTxHistoryActions();
  const [{ isFirstTimeSwap }, setSettings] = useSettingsPersistAtom();
  const { navigationToSendConfirm } = useSendConfirm({
    accountId: swapFromAddressInfo.accountInfo?.account?.id ?? '',
    networkId: swapFromAddressInfo.networkId ?? '',
  });
  const pageType = usePageType();
  const syncRecentTokenPairs = useCallback(
    async ({
      swapFromToken,
      swapToToken,
    }: {
      swapFromToken: ISwapToken;
      swapToToken: ISwapToken;
    }) => {
      await backgroundApiProxy.serviceSwap.swapRecentTokenPairsUpdate({
        fromToken: swapFromToken,
        toToken: swapToToken,
      });
    },
    [],
  );

  const handleBuildTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        setSwapFromTokenAmount(''); // send success, clear from token amount
        setSwapQuoteResultList([]);
        setSwapQuoteEventTotalCount(0);
        const transactionSignedInfo = data[0].signedTx;
        const transactionDecodedInfo = data[0].decodedTx;
        const txId = transactionSignedInfo.txid;
        const { swapInfo } = transactionSignedInfo;
        const { totalFeeInNative, totalFeeFiatValue, networkId } =
          transactionDecodedInfo;
        if (swapInfo) {
          await generateSwapHistoryItem({
            txId,
            gasFeeFiatValue: totalFeeFiatValue,
            gasFeeInNative: totalFeeInNative,
            swapTxInfo: swapInfo,
          });
          if (
            swapInfo.sender.token.networkId ===
            swapInfo.receiver.token.networkId
          ) {
            void backgroundApiProxy.serviceNotification.blockNotificationForTxId(
              {
                networkId,
                tx: txId,
              },
            );
          }
        }
      }
      setSwapBuildTxFetching(false);
    },
    [
      generateSwapHistoryItem,
      setSwapBuildTxFetching,
      setSwapFromTokenAmount,
      setSwapQuoteResultList,
      setSwapQuoteEventTotalCount,
    ],
  );

  const handleApproveTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        const transactionSignedInfo = data[0].signedTx;
        const txId = transactionSignedInfo.txid;
        if (
          inAppNotificationAtom.swapApprovingTransaction &&
          !inAppNotificationAtom.swapApprovingTransaction.resetApproveValue
        ) {
          void backgroundApiProxy.serviceNotification.blockNotificationForTxId({
            networkId:
              inAppNotificationAtom.swapApprovingTransaction.fromToken
                .networkId,
            tx: txId,
          });
        }
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
    [inAppNotificationAtom.swapApprovingTransaction, setInAppNotificationAtom],
  );

  const handleTxFail = useCallback(() => {
    setSwapBuildTxFetching(false);
  }, [setSwapBuildTxFetching]);

  const cancelBuildTx = useCallback(() => {
    handleTxFail();
    setSwapShouldRefreshQuote(true);
  }, [handleTxFail, setSwapShouldRefreshQuote]);

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
        onCancel: handleTxFail,
      });
      void syncRecentTokenPairs({
        swapFromToken: fromToken,
        swapToToken: toToken,
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
    syncRecentTokenPairs,
  ]);

  const createBuildTx = useCallback(async () => {
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
              memo: res.swftOrder.memo,
            };
          } else if (res?.changellyOrder) {
            encodedTx = undefined;
            // changelly order
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
              to: res.changellyOrder.payinAddress,
              amount: res.changellyOrder.amountExpectedFrom,
              memo: res.changellyOrder.payinExtraId,
            };
          } else if (res?.thorSwapCallData) {
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
          } else if (res?.tx) {
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
          // check gasLimit
          const buildGasLimitBN = new BigNumber(res.result?.gasLimit ?? 0);
          const quoteGasLimitBN = new BigNumber(selectQuote?.gasLimit ?? 0);
          if (
            (buildGasLimitBN.isNaN() || buildGasLimitBN.isZero()) &&
            !quoteGasLimitBN.isNaN() &&
            !quoteGasLimitBN.isZero()
          ) {
            res.result.gasLimit = quoteGasLimitBN.toNumber();
          }
          // check routes
          if (
            !res.result?.routesData?.length &&
            selectQuote?.routesData?.length
          ) {
            res.result.routesData = selectQuote.routesData;
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
          return { swapInfo, transferInfo, encodedTx };
        }
      } catch (e) {
        console.error(e);
      }
      return null;
    }
  }, [
    fromToken,
    selectQuote?.fromAmount,
    selectQuote?.gasLimit,
    selectQuote?.info.provider,
    selectQuote?.quoteResultCtx,
    selectQuote?.routesData,
    selectQuote?.toAmount,
    slippageItem,
    swapFromAddressInfo.accountInfo?.account?.id,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapToAddressInfo.address,
    toToken,
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
        if (settingsPersistAtom.swapBatchApproveAndSwap) {
          try {
            setSwapBuildTxFetching(true);
            let approvesInfo: IApproveInfo[] = [];
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
            approvesInfo = [approveInfo];
            if (resetApproveValue && amount === swapApproveResetValue) {
              const approveResetInfo: IApproveInfo = {
                owner: swapFromAddressInfo.address,
                spender: allowanceInfo.allowanceTarget,
                amount: resetApproveValue,
                isMax,
                tokenInfo: {
                  ...fromToken,
                  isNative: !!fromToken.isNative,
                  address: fromToken.contractAddress,
                  name: fromToken.name ?? fromToken.symbol,
                },
              };
              approvesInfo = [...approvesInfo, approveResetInfo];
            }
            const createBuildTxRes = await createBuildTx();
            if (createBuildTxRes) {
              if (
                accountUtils.isHwAccount({
                  accountId: swapFromAddressInfo.accountInfo.account.id,
                }) ||
                accountUtils.isOthersAccount({
                  accountId: swapFromAddressInfo.accountInfo.account.id,
                })
              ) {
                await navigationToSendConfirm({
                  approvesInfo: [approvesInfo[0]],
                  onSuccess: async (data: ISendTxOnSuccessData[]) => {
                    if (approvesInfo.length > 1) {
                      await navigationToSendConfirm({
                        approvesInfo: [approvesInfo[1]],
                        feeInfo: data?.[0]?.feeInfo,
                        onSuccess: async (dataRes: ISendTxOnSuccessData[]) => {
                          await navigationToSendConfirm({
                            transfersInfo: createBuildTxRes.transferInfo
                              ? [createBuildTxRes.transferInfo]
                              : undefined,
                            encodedTx: createBuildTxRes.encodedTx,
                            feeInfo: dataRes?.[0]?.feeInfo,
                            swapInfo: createBuildTxRes.swapInfo,
                            onSuccess: handleBuildTxSuccess,
                            onCancel: cancelBuildTx,
                          });
                        },
                        onCancel: cancelBuildTx,
                      });
                    } else {
                      await navigationToSendConfirm({
                        transfersInfo: createBuildTxRes.transferInfo
                          ? [createBuildTxRes.transferInfo]
                          : undefined,
                        encodedTx: createBuildTxRes.encodedTx,
                        swapInfo: createBuildTxRes.swapInfo,
                        feeInfo: data?.[0]?.feeInfo,
                        onSuccess: handleBuildTxSuccess,
                        onCancel: cancelBuildTx,
                      });
                    }
                  },
                  onCancel: cancelBuildTx,
                });
              } else {
                await navigationToSendConfirm({
                  transfersInfo: createBuildTxRes.transferInfo
                    ? [createBuildTxRes.transferInfo]
                    : undefined,
                  encodedTx: createBuildTxRes.encodedTx,
                  swapInfo: createBuildTxRes.swapInfo,
                  approvesInfo,
                  onSuccess: handleBuildTxSuccess,
                  onCancel: cancelBuildTx,
                });
              }
              void syncRecentTokenPairs({
                swapFromToken: fromToken,
                swapToToken: toToken,
              });
              defaultLogger.swap.createSwapOrder.swapCreateOrder({
                swapProvider: selectQuote?.info.provider,
                swapProviderName: selectQuote?.info.providerName,
                swapType: EProtocolOfExchange.SWAP,
                slippage: slippageItem.value.toString(),
                sourceChain: fromToken.networkId,
                receivedChain: toToken.networkId,
                sourceTokenSymbol: fromToken.symbol,
                receivedTokenSymbol: toToken.symbol,
                feeType: selectQuote?.fee?.percentageFee?.toString() ?? '0',
                router: JSON.stringify(selectQuote?.routesData ?? ''),
                isFirstTime: isFirstTimeSwap,
                createFrom: pageType === EPageType.modal ? 'modal' : 'swapPage',
              });
              setSettings((prev) => ({
                ...prev,
                isFirstTimeSwap: false,
              }));
            } else {
              setSwapBuildTxFetching(false);
              setSwapShouldRefreshQuote(true);
            }
          } catch (e) {
            console.error(e);
            setSwapBuildTxFetching(false);
            setSwapShouldRefreshQuote(true);
          }
        } else {
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
              approvesInfo: [approveInfo],
              onSuccess: handleApproveTxSuccess,
              onCancel: cancelApproveTx,
            });
          } catch (e) {
            setSwapBuildTxFetching(false);
          }
        }
      }
    },
    [
      selectQuote?.allowanceResult,
      selectQuote?.info.provider,
      selectQuote?.info.providerName,
      selectQuote?.fee?.percentageFee,
      selectQuote?.routesData,
      fromToken,
      toToken,
      swapFromAddressInfo.networkId,
      swapFromAddressInfo.accountInfo?.account?.id,
      swapFromAddressInfo.address,
      settingsPersistAtom.swapBatchApproveAndSwap,
      setSwapBuildTxFetching,
      createBuildTx,
      navigationToSendConfirm,
      handleBuildTxSuccess,
      cancelBuildTx,
      syncRecentTokenPairs,
      slippageItem.value,
      isFirstTimeSwap,
      pageType,
      setSettings,
      setSwapShouldRefreshQuote,
      setInAppNotificationAtom,
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
      setSwapBuildTxFetching(true);
      const createBuildTxRes = await createBuildTx();
      try {
        if (createBuildTxRes) {
          await navigationToSendConfirm({
            transfersInfo: createBuildTxRes.transferInfo
              ? [createBuildTxRes.transferInfo]
              : undefined,
            encodedTx: createBuildTxRes.encodedTx,
            swapInfo: createBuildTxRes.swapInfo,
            onSuccess: handleBuildTxSuccess,
            onCancel: cancelBuildTx,
          });
          void syncRecentTokenPairs({
            swapFromToken: fromToken,
            swapToToken: toToken,
          });
          defaultLogger.swap.createSwapOrder.swapCreateOrder({
            swapProvider: selectQuote?.info.provider,
            swapProviderName: selectQuote?.info.providerName,
            swapType: EProtocolOfExchange.SWAP,
            slippage: slippageItem.value.toString(),
            sourceChain: fromToken.networkId,
            receivedChain: toToken.networkId,
            sourceTokenSymbol: fromToken.symbol,
            receivedTokenSymbol: toToken.symbol,
            feeType: selectQuote?.fee?.percentageFee?.toString() ?? '0',
            router: JSON.stringify(selectQuote?.routesData ?? ''),
            isFirstTime: isFirstTimeSwap,
            createFrom: pageType === EPageType.modal ? 'modal' : 'swapPage',
          });
          setSettings((prev) => ({
            ...prev,
            isFirstTimeSwap: false,
          }));
        } else {
          setSwapBuildTxFetching(false);
          setSwapShouldRefreshQuote(true);
        }
      } catch (e) {
        setSwapBuildTxFetching(false);
        setSwapShouldRefreshQuote(true);
      }
    }
  }, [
    fromToken,
    toToken,
    selectQuote?.fromAmount,
    selectQuote?.toAmount,
    selectQuote?.info.provider,
    selectQuote?.info.providerName,
    selectQuote?.fee?.percentageFee,
    selectQuote?.routesData,
    slippageItem,
    swapFromAddressInfo.address,
    swapFromAddressInfo.networkId,
    swapToAddressInfo.address,
    setSwapBuildTxFetching,
    createBuildTx,
    navigationToSendConfirm,
    handleBuildTxSuccess,
    cancelBuildTx,
    syncRecentTokenPairs,
    isFirstTimeSwap,
    pageType,
    setSettings,
    setSwapShouldRefreshQuote,
  ]);

  return { buildTx, wrappedTx, approveTx };
}
