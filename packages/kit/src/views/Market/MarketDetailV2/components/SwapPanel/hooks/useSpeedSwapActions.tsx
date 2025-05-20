import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IApproveInfo,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ISwapApproveTransaction,
  ISwapTokenBase,
  ISwapTxHistory,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

export function useSpeedSwapActions({
  token,
  accountId,
}: {
  token: ISwapTokenBase;
  accountId?: string;
}) {
  const intl = useIntl();
  const [inAppNotificationAtom, setInAppNotificationAtom] =
    useInAppNotificationAtom();
  const [settingsAtom] = useSettingsPersistAtom();
  const [speedSwapBuildTxLoading, setSpeedSwapBuildTxLoading] = useState(false);
  const [checkTokenAllowanceLoading, setCheckTokenAllowanceLoading] =
    useState(false);
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: accountId ?? '',
    networkId: token.networkId,
  });

  // --- build tx

  const handleSpeedSwapBuildTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      const transactionSignedInfo = data[0].signedTx;
      const transactionDecodedInfo = data[0].decodedTx;
      const txId = transactionSignedInfo.txid;
      const { swapInfo } = transactionSignedInfo;
      const {
        totalFeeInNative,
        totalFeeFiatValue,
        networkId: txNetworkId,
      } = transactionDecodedInfo;
      if (swapInfo) {
        const fromNetworkPreset = Object.values(presetNetworksMap).find(
          (item) => item.id === swapInfo.sender.token.networkId,
        );
        const toNetworkPreset = Object.values(presetNetworksMap).find(
          (item) => item.id === swapInfo.receiver.token.networkId,
        );
        if (
          swapInfo &&
          (swapInfo.protocol === EProtocolOfExchange.SWAP ||
            swapInfo.swapBuildResData.result.isWrapped)
        ) {
          const useOrderId = false;
          const swapHistoryItem: ISwapTxHistory = {
            status: ESwapTxHistoryStatus.PENDING,
            currency: settingsAtom.currencyInfo?.symbol,
            accountInfo: {
              sender: {
                accountId: swapInfo.sender.accountInfo?.accountId,
                networkId: swapInfo.sender.accountInfo?.networkId,
              },
              receiver: {
                accountId: swapInfo.receiver.accountInfo?.accountId,
                networkId: swapInfo.receiver.accountInfo?.networkId,
              },
            },
            baseInfo: {
              toAmount: swapInfo.receiver.amount,
              fromAmount: swapInfo.sender.amount,
              fromToken: swapInfo.sender.token,
              toToken: swapInfo.receiver.token,
              fromNetwork: {
                networkId: fromNetworkPreset?.id ?? '',
                name: fromNetworkPreset?.name ?? '',
                symbol: fromNetworkPreset?.symbol ?? '',
                logoURI: fromNetworkPreset?.logoURI ?? '',
                shortcode: fromNetworkPreset?.shortcode ?? '',
              },
              toNetwork: {
                networkId: toNetworkPreset?.id ?? '',
                name: toNetworkPreset?.name ?? '',
                symbol: toNetworkPreset?.symbol ?? '',
                logoURI: toNetworkPreset?.logoURI ?? '',
                shortcode: toNetworkPreset?.shortcode ?? '',
              },
            },
            txInfo: {
              txId,
              useOrderId,
              gasFeeFiatValue: totalFeeFiatValue,
              gasFeeInNative: totalFeeInNative,
              sender: swapInfo.accountAddress,
              receiver: swapInfo.receivingAddress,
            },
            date: {
              created: Date.now(),
              updated: Date.now(),
            },
            swapInfo: {
              instantRate: swapInfo.swapBuildResData.result?.instantRate ?? '0',
              provider: swapInfo.swapBuildResData.result?.info,
              socketBridgeScanUrl:
                swapInfo.swapBuildResData.socketBridgeScanUrl,
              oneKeyFee:
                swapInfo.swapBuildResData.result?.fee?.percentageFee ?? 0,
              protocolFee:
                swapInfo.swapBuildResData.result?.fee?.protocolFees ?? 0,
              otherFeeInfos:
                swapInfo.swapBuildResData.result?.fee?.otherFeeInfos ?? [],
              orderId: swapInfo.swapBuildResData.orderId,
              supportUrl: swapInfo.swapBuildResData.result?.supportUrl,
              orderSupportUrl:
                swapInfo.swapBuildResData.result?.orderSupportUrl,
              oneKeyFeeExtraInfo:
                swapInfo.swapBuildResData.result?.oneKeyFeeExtraInfo,
            },
            ctx: swapInfo.swapBuildResData.ctx,
          };
          await backgroundApiProxy.serviceSwap.addSwapHistoryItem(
            swapHistoryItem,
          );
          if (
            swapInfo.sender.token.networkId ===
            swapInfo.receiver.token.networkId
          ) {
            void backgroundApiProxy.serviceNotification.blockNotificationForTxId(
              {
                networkId: txNetworkId,
                tx: txId,
              },
            );
          }
        }
      }
    },
    [settingsAtom.currencyInfo?.symbol],
  );

  const cancelSpeedSwapBuildTx = useCallback(() => {
    // todo cancel build tx
  }, []);

  const speedSwapBuildTx = useCallback(
    async ({
      fromToken,
      toToken,
      amount,
      slippage,
      provider,
    }: {
      fromToken: ISwapTokenBase;
      toToken: ISwapTokenBase;
      amount: string;
      slippage: number;
      provider: string;
    }) => {
      setSpeedSwapBuildTxLoading(true);
      const userAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId: accountId ?? '',
          networkId: fromToken.networkId,
        });
      const buildRes =
        await backgroundApiProxy.serviceSwap.fetchBuildSpeedSwapTx({
          fromToken,
          toToken,
          fromTokenAmount: amount,
          provider,
          userAddress,
          receivingAddress: userAddress,
          slippagePercentage: slippage,
          accountId,
          protocol: EProtocolOfExchange.SWAP,
          kind: ESwapQuoteKind.SELL,
        });
      if (!buildRes) {
        return;
      }
      let transferInfo: ITransferInfo | undefined;
      let encodedTx: IEncodedTx | undefined;
      if (buildRes?.OKXTxObject) {
        encodedTx = await backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx({
          accountId: accountId ?? '',
          networkId: fromToken.networkId,
          okxTx: buildRes.OKXTxObject,
          fromTokenInfo: buildRes.result.fromTokenInfo,
          type: ESwapTabSwitchType.SWAP,
        });
      } else if (buildRes?.tx) {
        transferInfo = undefined;
        if (typeof buildRes.tx !== 'string' && buildRes.tx.data) {
          const valueHex = toBigIntHex(new BigNumber(buildRes.tx.value ?? 0));
          encodedTx = {
            ...buildRes?.tx,
            value: valueHex,
            from: userAddress,
          };
        } else {
          encodedTx = buildRes.tx as string;
        }
      }
      const swapInfo: ISwapTxInfo = {
        protocol: EProtocolOfExchange.SWAP,
        sender: {
          amount,
          token: fromToken,
          accountInfo: {
            accountId: accountId ?? '',
            networkId: fromToken.networkId,
          },
        },
        receiver: {
          amount: buildRes?.result.toAmount ?? '',
          token: toToken,
          accountInfo: {
            accountId: accountId ?? '',
            networkId: toToken.networkId,
          },
        },
        accountAddress: userAddress,
        receivingAddress: userAddress,
        swapBuildResData: {
          ...buildRes,
          result: {
            ...(buildRes?.result ?? {}),
            slippage: buildRes?.result?.slippage ?? slippage,
          },
        },
      };
      setSpeedSwapBuildTxLoading(false);
      await navigationToTxConfirm({
        isInternalSwap: true,
        transfersInfo: transferInfo ? [transferInfo] : undefined,
        encodedTx,
        swapInfo,
        approvesInfo: [], // todo
        onSuccess: handleSpeedSwapBuildTxSuccess,
        onCancel: cancelSpeedSwapBuildTx,
      });
      return buildRes;
    },
    [
      accountId,
      navigationToTxConfirm,
      handleSpeedSwapBuildTxSuccess,
      cancelSpeedSwapBuildTx,
    ],
  );

  // --- approve

  const handleSpeedSwapApproveTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      if (data?.[0]) {
        const transactionSignedInfo = data[0].signedTx;
        const approveInfo = data[0].approveInfo;
        const txId = transactionSignedInfo.txid;
        if (
          inAppNotificationAtom.speedSwapApprovingTransaction &&
          !inAppNotificationAtom.speedSwapApprovingTransaction.resetApproveValue
        ) {
          void backgroundApiProxy.serviceNotification.blockNotificationForTxId({
            networkId:
              inAppNotificationAtom.speedSwapApprovingTransaction.fromToken
                .networkId,
            tx: txId,
          });
        }
        setInAppNotificationAtom((prev) => {
          if (prev.speedSwapApprovingTransaction) {
            return {
              ...prev,
              speedSwapApprovingTransaction: {
                ...prev.speedSwapApprovingTransaction,
                txId,
                resetApproveIsMax: !!approveInfo?.isMax,
                ...(approveInfo
                  ? {
                      amount: approveInfo.amount,
                    }
                  : {}),
              },
            };
          }
          return prev;
        });
      }
    },
    [
      inAppNotificationAtom.speedSwapApprovingTransaction,
      setInAppNotificationAtom,
    ],
  );

  const cancelSpeedSwapApproveTx = useCallback(() => {
    setInAppNotificationAtom((prev) => {
      if (prev.speedSwapApprovingTransaction) {
        return {
          ...prev,
          speedSwapApprovingTransaction: {
            ...prev.speedSwapApprovingTransaction,
            status: ESwapApproveTransactionStatus.CANCEL,
          },
        };
      }
      return prev;
    });
  }, [setInAppNotificationAtom]);

  const checkTokenApproveAllowance = useCallback(
    async (spenderAddress: string) => {
      setCheckTokenAllowanceLoading(true);
      const userAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId: accountId ?? '',
          networkId: token.networkId,
        });
      const approveRes =
        await backgroundApiProxy.serviceSwap.fetchApproveAllowance({
          networkId: token.networkId,
          tokenAddress: token.contractAddress,
          spenderAddress,
          walletAddress: userAddress,
        });
      setCheckTokenAllowanceLoading(false);
      return approveRes;
    },
    [accountId, token.contractAddress, token.networkId],
  );

  const approveRun = useCallback(
    async ({
      provider,
      spenderAddress,
      amount,
      isReset,
      fromToken,
      toToken,
    }: {
      provider: string;
      spenderAddress: string;
      amount: string;
      isReset?: boolean;
      fromToken: ISwapTokenBase;
      toToken: ISwapTokenBase;
    }) => {
      try {
        setInAppNotificationAtom((pre) => ({
          ...pre,
          speedSwapApprovingLoading: true,
        }));
        const userAddress =
          await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
            accountId: accountId ?? '',
            networkId: token.networkId,
          });
        const approveInfo: IApproveInfo = {
          owner: userAddress,
          spender: spenderAddress,
          amount: isReset ? '0' : amount,
          isMax: !isReset,
          tokenInfo: {
            ...fromToken,
            isNative: !!fromToken.isNative,
            address: fromToken.contractAddress,
            name: fromToken.name ?? fromToken.symbol,
          },
          swapApproveRes: undefined,
        };
        await navigationToTxConfirm({
          approvesInfo: [approveInfo],
          isInternalSwap: true,
          onSuccess: handleSpeedSwapApproveTxSuccess,
          onCancel: cancelSpeedSwapApproveTx,
        });
        setInAppNotificationAtom((pre) => ({
          ...pre,
          speedSwapApprovingTransaction: {
            swapType: ESwapTabSwitchType.SWAP,
            protocol: EProtocolOfExchange.SWAP,
            provider,
            providerName: provider,
            unSupportReceiveAddressDifferent: false,
            fromToken,
            toToken,
            amount,
            toAmount: amount,
            useAddress: userAddress,
            spenderAddress,
            status: ESwapApproveTransactionStatus.PENDING,
            kind: ESwapQuoteKind.SELL,
            resetApproveValue: isReset ? '0' : amount,
            resetApproveIsMax: !isReset,
          },
        }));
      } catch (e) {
        setInAppNotificationAtom((pre) => ({
          ...pre,
          speedSwapApprovingLoading: false,
        }));
      }
    },
    [
      accountId,
      setInAppNotificationAtom,
      token,
      navigationToTxConfirm,
      handleSpeedSwapApproveTxSuccess,
      cancelSpeedSwapApproveTx,
    ],
  );

  const speedSwapApproveHandler = useCallback(
    async ({
      provider,
      spenderAddress,
      amount,
      isReset,
      fromToken,
      toToken,
    }: {
      provider: string;
      spenderAddress: string;
      amount: string;
      isReset?: boolean;
      fromToken: ISwapTokenBase;
      toToken: ISwapTokenBase;
    }) => {
      if (isReset) {
        Dialog.confirm({
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_continue,
          }),
          onConfirm: () => {
            void approveRun({
              provider,
              spenderAddress,
              amount,
              isReset,
              fromToken,
              toToken,
            });
          },
          showCancelButton: true,
          title: intl.formatMessage({
            id: ETranslations.swap_page_provider_approve_usdt_dialog_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.swap_page_provider_approve_usdt_dialog_content,
          }),
          icon: 'ErrorOutline',
        });
      } else {
        void approveRun({
          provider,
          spenderAddress,
          amount,
          isReset,
          fromToken,
          toToken,
        });
      }
    },
    [approveRun, intl],
  );
  const speedSwapApproveLoading = useMemo(() => {
    const speedSwapApproveTransaction =
      inAppNotificationAtom.speedSwapApprovingTransaction;
    if (
      speedSwapApproveTransaction &&
      inAppNotificationAtom.speedSwapApprovingLoading &&
      (equalTokenNoCaseSensitive({
        token1: speedSwapApproveTransaction.fromToken,
        token2: token,
      }) ||
        equalTokenNoCaseSensitive({
          token1: speedSwapApproveTransaction.toToken,
          token2: token,
        }))
    ) {
      return true;
    }
    return false;
  }, [
    inAppNotificationAtom.speedSwapApprovingLoading,
    inAppNotificationAtom.speedSwapApprovingTransaction,
    token,
  ]);

  const handleSwapSpeedApprovingReset = useCallback(
    ({ approvedSwapInfo }: { approvedSwapInfo: ISwapApproveTransaction }) => {
      if (approvedSwapInfo.resetApproveValue) {
        void approveRun({
          provider: approvedSwapInfo.provider,
          spenderAddress: approvedSwapInfo.spenderAddress,
          amount: approvedSwapInfo.resetApproveValue,
          isReset: false,
          fromToken: approvedSwapInfo.fromToken,
          toToken: approvedSwapInfo.toToken,
        });
      }
    },
    [approveRun],
  );

  useEffect(() => {
    appEventBus.off(
      EAppEventBusNames.SwapSpeedApprovingReset,
      handleSwapSpeedApprovingReset,
    );
    appEventBus.on(
      EAppEventBusNames.SwapSpeedApprovingReset,
      handleSwapSpeedApprovingReset,
    );
  }, [handleSwapSpeedApprovingReset]);

  return {
    speedSwapBuildTx,
    speedSwapBuildTxLoading,
    checkTokenApproveAllowance,
    checkTokenAllowanceLoading,
    speedSwapApproveHandler,
    speedSwapApproveLoading,
  };
}
