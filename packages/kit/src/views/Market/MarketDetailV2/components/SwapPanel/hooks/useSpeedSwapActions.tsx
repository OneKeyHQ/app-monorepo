import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapEventAPIStatus } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import {
  checkWrappedTokenPair,
  equalTokenNoCaseSensitive,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { wrappedTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapApproveTransaction,
  ISwapNativeTokenReserveGas,
  ISwapTokenBase,
  ISwapTxHistory,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapApproveTransactionStatus,
  ESwapFetchCancelCause,
  ESwapQuoteKind,
  ESwapTabSwitchType,
  ESwapTxHistoryStatus,
  EWrappedType,
} from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { ESwapDirection } from './useTradeType';

export function useSpeedSwapActions(props: {
  marketToken: ISwapTokenBase;
  tradeToken: ISwapTokenBase;
  tradeType: ESwapDirection;
  fromTokenAmount: string;
  provider: string;
  spenderAddress: string;
  slippage: number;
  defaultTradeTokens: ISwapTokenBase[];
  antiMEV: boolean;
  onCloseDialog?: () => void;
}) {
  const {
    marketToken,
    fromTokenAmount,
    tradeToken,
    tradeType,
    provider,
    spenderAddress,
    slippage,
    defaultTradeTokens,
    antiMEV,
    // onCloseDialog,
  } = props;

  const intl = useIntl();
  const [inAppNotificationAtom, setInAppNotificationAtom] =
    useInAppNotificationAtom();
  const [settingsAtom] = useSettingsPersistAtom();
  const { activeAccount: account } = useActiveAccount({ num: 0 });
  const [shouldApprove, setShouldApprove] = useState(false);
  const [shouldResetApprove, setShouldResetApprove] = useState(false);
  const [speedSwapBuildTxLoading, setSpeedSwapBuildTxLoading] = useState(false);
  const [checkTokenAllowanceLoading, setCheckTokenAllowanceLoading] =
    useState(false);
  const [baseToken, setBaseToken] = useState<ISwapTokenBase | undefined>();
  const [fetchBalanceLoading, setFetchBalanceLoading] = useState(false);
  const [swapNativeTokenReserveGas, setSwapNativeTokenReserveGas] = useState<
    ISwapNativeTokenReserveGas[]
  >([]);
  const [{ isFirstTimeSwap }] = useSettingsPersistAtom();
  const [priceRate, setPriceRate] = useState<
    | {
        rate?: number;
        fromTokenSymbol?: string;
        toTokenSymbol?: string;
        loading?: boolean;
      }
    | undefined
  >(undefined);
  const [balance, setBalance] = useState<BigNumber | undefined>(
    new BigNumber(0),
  );

  const netAccountRes = usePromiseResult(async () => {
    try {
      const res = await backgroundApiProxy.serviceAccount.getNetworkAccount({
        accountId: account?.indexedAccount?.id
          ? undefined
          : account?.account?.id,
        indexedAccountId: account?.indexedAccount?.id ?? '',
        networkId: marketToken?.networkId,
        deriveType: account?.deriveType ?? 'default',
      });
      return res;
    } catch (e) {
      return undefined;
    }
  }, [account, marketToken?.networkId]);
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: netAccountRes.result?.id ?? '',
    networkId: marketToken?.networkId,
  });
  const fromTokenAmountDebounced = useDebounce(fromTokenAmount, 300, {
    leading: true,
  });

  const { fromToken, toToken, balanceToken } = useMemo(() => {
    if (tradeType === ESwapDirection.BUY) {
      return {
        fromToken: tradeToken,
        toToken: baseToken ?? marketToken,
        balanceToken: tradeToken,
      };
    }
    return {
      fromToken: baseToken ?? marketToken,
      toToken: defaultTradeTokens?.find((item) => item.isNative) ?? tradeToken,
      balanceToken: baseToken ?? marketToken,
    };
  }, [tradeType, baseToken, marketToken, defaultTradeTokens, tradeToken]);

  // --- build tx

  const handleSpeedSwapBuildTxSuccess = useCallback(
    async (data: ISendTxOnSuccessData[]) => {
      setSpeedSwapBuildTxLoading(false);
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
        appEventBus.emit(EAppEventBusNames.SwapSpeedBuildTxSuccess, {
          fromToken,
          toToken,
          fromAmount: swapInfo.sender.amount,
          toAmount: swapInfo.receiver.amount,
        });

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
    [settingsAtom.currencyInfo?.symbol, fromToken, toToken],
  );

  const cancelSpeedSwapBuildTx = useCallback(() => {
    // todo cancel build tx
    setSpeedSwapBuildTxLoading(false);
  }, []);

  const isWrapped = useMemo(
    () => checkWrappedTokenPair({ fromToken, toToken }),
    [fromToken, toToken],
  );

  const speedSwapBuildTx = useCallback(async () => {
    setSpeedSwapBuildTxLoading(true);
    const userAddress = netAccountRes.result?.address ?? '';
    const buildParams = {
      fromToken,
      toToken,
      fromTokenAmount: fromTokenAmountDebounced,
      provider,
      userAddress,
      receivingAddress: userAddress,
      slippagePercentage: slippage,
      accountId: netAccountRes.result?.id ?? '',
      protocol: EProtocolOfExchange.SWAP,
      kind: ESwapQuoteKind.SELL,
    };
    const buildRes = await backgroundApiProxy.serviceSwap.fetchBuildSpeedSwapTx(
      buildParams,
    );
    if (!buildRes) {
      setSpeedSwapBuildTxLoading(false);
      return;
    }
    try {
      let transferInfo: ITransferInfo | undefined;
      let encodedTx: IEncodedTx | undefined;
      if (buildRes?.OKXTxObject) {
        encodedTx = await backgroundApiProxy.serviceSwap.buildOkxSwapEncodedTx({
          accountId: netAccountRes.result?.id ?? '',
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
          amount: fromTokenAmount,
          token: fromToken,
          accountInfo: {
            accountId: netAccountRes.result?.id ?? '',
            networkId: fromToken.networkId,
          },
        },
        receiver: {
          amount: buildRes?.result.toAmount ?? '',
          token: toToken,
          accountInfo: {
            accountId: netAccountRes.result?.id ?? '',
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
      // onCloseDialog?.();
      await navigationToTxConfirm({
        isInternalSwap: true,
        transfersInfo: transferInfo ? [transferInfo] : undefined,
        encodedTx,
        swapInfo,
        approvesInfo: [], // todo
        onSuccess: handleSpeedSwapBuildTxSuccess,
        onCancel: cancelSpeedSwapBuildTx,
        disableMev: !antiMEV,
      });

      defaultLogger.swap.createSwapOrder.swapCreateOrder({
        fromTokenAmount,
        fromAddress: userAddress,
        toAddress: userAddress,
        toTokenAmount: buildRes.result?.toAmount ?? '',
        status: ESwapEventAPIStatus.SUCCESS,
        swapProvider: buildRes.result?.info.provider ?? '',
        swapProviderName: buildRes.result?.info.providerName ?? '',
        swapType: ESwapTabSwitchType.SWAP,
        slippage: slippage.toString(),
        sourceChain: fromToken.networkId ?? '',
        receivedChain: toToken.networkId ?? '',
        sourceTokenSymbol: fromToken.symbol ?? '',
        receivedTokenSymbol: toToken.symbol ?? '',
        feeType: buildRes.result?.fee?.percentageFee?.toString() ?? '0',
        router: JSON.stringify(buildRes.result?.routesData ?? ''),
        isFirstTime: isFirstTimeSwap,
        createFrom: 'marketDex',
      });

      return buildRes;
    } catch (e) {
      setSpeedSwapBuildTxLoading(false);
      defaultLogger.swap.createSwapOrder.swapCreateOrder({
        fromTokenAmount,
        fromAddress: userAddress,
        toAddress: userAddress,
        toTokenAmount: buildRes.result?.toAmount ?? '',
        status: ESwapEventAPIStatus.FAIL,
        swapProvider: buildRes.result?.info.provider ?? '',
        swapProviderName: buildRes.result?.info.providerName ?? '',
        swapType: ESwapTabSwitchType.SWAP,
        slippage: slippage.toString(),
        sourceChain: fromToken.networkId ?? '',
        receivedChain: toToken.networkId ?? '',
        sourceTokenSymbol: fromToken.symbol ?? '',
        receivedTokenSymbol: toToken.symbol ?? '',
        feeType: buildRes.result?.fee?.percentageFee?.toString() ?? '0',
        router: JSON.stringify(buildRes.result?.routesData ?? ''),
        isFirstTime: isFirstTimeSwap,
        createFrom: 'marketDex',
      });
    }
  }, [
    netAccountRes.result?.address,
    netAccountRes.result?.id,
    fromToken,
    toToken,
    fromTokenAmountDebounced,
    provider,
    slippage,
    fromTokenAmount,
    navigationToTxConfirm,
    handleSpeedSwapBuildTxSuccess,
    cancelSpeedSwapBuildTx,
    antiMEV,
    isFirstTimeSwap,
    // onCloseDialog,
  ]);

  const speedSwapWrappedTx = useCallback(async () => {
    if (netAccountRes.result?.address) {
      const wrappedType = fromToken.isNative
        ? EWrappedType.DEPOSIT
        : EWrappedType.WITHDRAW;
      const wrappedInfo: IWrappedInfo = {
        from: netAccountRes.result?.address,
        type: wrappedType,
        contract:
          wrappedType === EWrappedType.WITHDRAW
            ? fromToken.contractAddress
            : toToken.contractAddress,
        amount: fromTokenAmountDebounced,
      };
      const swapInfo: ISwapTxInfo = {
        protocol: EProtocolOfExchange.SWAP,
        sender: {
          amount: fromTokenAmountDebounced,
          token: fromToken,
          accountInfo: {
            accountId: netAccountRes.result?.id ?? '',
            networkId: fromToken.networkId,
          },
        },
        receiver: {
          amount: fromTokenAmountDebounced,
          token: toToken,
          accountInfo: {
            accountId: netAccountRes.result?.id ?? '',
            networkId: toToken.networkId,
          },
        },
        accountAddress: netAccountRes.result?.address,
        receivingAddress: netAccountRes.result?.address,
        swapBuildResData: {
          orderId: stringUtils.generateUUID(),
          result: {
            info: {
              provider: 'wrapped',
              providerName: 'wrapped',
              providerLogo: wrappedTokens.find(
                (item) => item.networkId === fromToken.networkId,
              )?.logo,
            },
            fromTokenInfo: fromToken,
            toTokenInfo: toToken,
            fromAmount: fromTokenAmountDebounced,
            toAmount: fromTokenAmountDebounced,
          },
        },
      };
      setSpeedSwapBuildTxLoading(true);
      await navigationToTxConfirm({
        isInternalSwap: true,
        wrappedInfo,
        swapInfo,
        onSuccess: handleSpeedSwapBuildTxSuccess,
        onCancel: cancelSpeedSwapBuildTx,
        disableMev: !antiMEV,
      });
    }
  }, [
    netAccountRes.result?.address,
    netAccountRes.result?.id,
    fromToken,
    toToken,
    fromTokenAmountDebounced,
    navigationToTxConfirm,
    handleSpeedSwapBuildTxSuccess,
    cancelSpeedSwapBuildTx,
    antiMEV,
  ]);

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
    async (amount: string) => {
      const amountBN = new BigNumber(amount ?? 0);
      try {
        if (
          !spenderAddress ||
          netAccountRes.result?.addressDetail.networkId !==
            fromToken.networkId ||
          !netAccountRes.result?.address ||
          amountBN.isZero() ||
          amountBN.isNaN() ||
          isWrapped
        ) {
          return;
        }
        setCheckTokenAllowanceLoading(true);

        const userAddress = netAccountRes.result?.address ?? '';

        const fetchApproveAllowanceParams = {
          networkId: fromToken.networkId,
          tokenAddress: fromToken.contractAddress,
          spenderAddress,
          walletAddress: userAddress,
          amount,
        };

        const approveRes =
          await backgroundApiProxy.serviceSwap.fetchApproveAllowance(
            fetchApproveAllowanceParams,
          );

        setShouldApprove(!approveRes.isApproved);
        setShouldResetApprove(!!approveRes.shouldResetApprove);
        setCheckTokenAllowanceLoading(false);
      } catch (e: any) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e.cause !== ESwapFetchCancelCause.SWAP_APPROVE_ALLOWANCE_CANCEL) {
          setCheckTokenAllowanceLoading(false);
        }
      }
    },
    [
      fromToken.contractAddress,
      fromToken.networkId,
      netAccountRes.result?.address,
      netAccountRes.result?.addressDetail.networkId,
      spenderAddress,
      isWrapped,
    ],
  );

  const approveRun = useCallback(
    async ({
      amount,
      isReset,
      fromToken: fromTokenParam,
      toToken: toTokenParam,
    }: {
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
        const userAddress = netAccountRes.result?.address ?? '';
        const approveInfo: IApproveInfo = {
          owner: userAddress,
          spender: spenderAddress,
          amount: isReset ? '0' : amount,
          isMax: !isReset,
          tokenInfo: {
            ...fromTokenParam,
            isNative: !!fromTokenParam.isNative,
            address: fromTokenParam.contractAddress,
            name: fromTokenParam.name ?? fromTokenParam.symbol,
          },
          swapApproveRes: undefined,
        };
        await navigationToTxConfirm({
          approvesInfo: [approveInfo],
          isInternalSwap: true,
          onSuccess: handleSpeedSwapApproveTxSuccess,
          onCancel: cancelSpeedSwapApproveTx,
          disableMev: !antiMEV,
        });
        setInAppNotificationAtom((pre) => ({
          ...pre,
          speedSwapApprovingTransaction: {
            swapType: ESwapTabSwitchType.SWAP,
            protocol: EProtocolOfExchange.SWAP,
            provider,
            providerName: provider,
            unSupportReceiveAddressDifferent: false,
            fromToken: fromTokenParam,
            toToken: toTokenParam,
            amount,
            toAmount: amount,
            useAddress: userAddress,
            spenderAddress,
            status: ESwapApproveTransactionStatus.PENDING,
            kind: ESwapQuoteKind.SELL,
            resetApproveValue: !isReset ? '0' : amount,
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
      setInAppNotificationAtom,
      netAccountRes.result?.address,
      spenderAddress,
      navigationToTxConfirm,
      handleSpeedSwapApproveTxSuccess,
      cancelSpeedSwapApproveTx,
      antiMEV,
      provider,
    ],
  );

  const speedSwapApproveHandler = useCallback(async () => {
    if (shouldResetApprove) {
      Dialog.confirm({
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          void approveRun({
            spenderAddress,
            amount: fromTokenAmountDebounced,
            isReset: shouldResetApprove,
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
        spenderAddress,
        amount: fromTokenAmountDebounced,
        isReset: shouldResetApprove,
        fromToken,
        toToken,
      });
    }
  }, [
    approveRun,
    fromToken,
    fromTokenAmountDebounced,
    intl,
    shouldResetApprove,
    spenderAddress,
    toToken,
  ]);
  const speedSwapApproveLoading = useMemo(() => {
    const speedSwapApproveTransaction =
      inAppNotificationAtom.speedSwapApprovingTransaction;
    const fromTokenAmountDebouncedBN = new BigNumber(
      fromTokenAmountDebounced ?? 0,
    );
    if (
      speedSwapApproveTransaction &&
      inAppNotificationAtom.speedSwapApprovingLoading &&
      equalTokenNoCaseSensitive({
        token1: speedSwapApproveTransaction.fromToken,
        token2: fromToken,
      }) &&
      speedSwapApproveTransaction.amount ===
        fromTokenAmountDebouncedBN.toFixed()
    ) {
      return true;
    }
    return false;
  }, [
    inAppNotificationAtom.speedSwapApprovingLoading,
    inAppNotificationAtom.speedSwapApprovingTransaction,
    fromToken,
    fromTokenAmountDebounced,
  ]);

  const handleSwapSpeedApprovingReset = useCallback(
    ({ approvedSwapInfo }: { approvedSwapInfo: ISwapApproveTransaction }) => {
      if (approvedSwapInfo.resetApproveValue) {
        void approveRun({
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

  const syncTokensBalance = useCallback(
    async ({
      orderFromToken,
      orderToToken,
    }: {
      orderFromToken?: ISwapTokenBase;
      orderToToken?: ISwapTokenBase;
    }) => {
      if (
        netAccountRes.result?.id &&
        netAccountRes.result?.address &&
        orderFromToken?.networkId ===
          netAccountRes.result?.addressDetail.networkId &&
        (equalTokenNoCaseSensitive({
          token1: orderFromToken,
          token2: {
            networkId: balanceToken?.networkId,
            contractAddress: balanceToken?.contractAddress,
          },
        }) ||
          equalTokenNoCaseSensitive({
            token1: orderToToken,
            token2: {
              networkId: balanceToken?.networkId,
              contractAddress: balanceToken?.contractAddress,
            },
          }))
      ) {
        setFetchBalanceLoading(true);
        try {
          const tokenDetail =
            await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: balanceToken?.networkId ?? '',
              contractAddress: balanceToken?.contractAddress ?? '',
              accountId: netAccountRes.result?.id ?? '',
              accountAddress: netAccountRes.result?.address ?? '',
            });
          if (tokenDetail?.length) {
            setBalance(new BigNumber(tokenDetail[0].balanceParsed ?? 0));
          }
          setFetchBalanceLoading(false);
        } catch (e) {
          setFetchBalanceLoading(false);
        }
      } else {
        setBalance(new BigNumber(0));
      }
    },
    [
      balanceToken?.networkId,
      balanceToken?.contractAddress,
      netAccountRes.result?.address,
      netAccountRes.result?.id,
      netAccountRes.result?.addressDetail.networkId,
    ],
  );

  const fetchTokenPrice = useCallback(async () => {
    setPriceRate((prev) => ({
      ...(prev ?? {}),
      loading: true,
    }));
    const [fromTokenPrice, toTokenPrice] = await Promise.all([
      backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
        networkId: fromToken.networkId ?? '',
        contractAddress: fromToken.contractAddress ?? '',
      }),
      backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
        networkId: toToken.networkId ?? '',
        contractAddress: toToken.contractAddress ?? '',
      }),
    ]);
    if (fromTokenPrice?.length && toTokenPrice?.length) {
      const fromTokenPriceBN = new BigNumber(fromTokenPrice[0].price || 0);
      const toTokenPriceBN = new BigNumber(toTokenPrice[0].price || 0);
      setPriceRate({
        rate: toTokenPriceBN.isZero()
          ? 0
          : fromTokenPriceBN.dividedBy(toTokenPriceBN).toNumber(),
        fromTokenSymbol: fromToken.symbol,
        toTokenSymbol: toToken.symbol,
        loading: false,
      });
    } else {
      setPriceRate((prev) => ({
        ...(prev ?? {}),
        loading: false,
      }));
    }
  }, [
    fromToken.symbol,
    toToken.symbol,
    fromToken.networkId,
    toToken.networkId,
    fromToken.contractAddress,
    toToken.contractAddress,
  ]);

  useEffect(() => {
    if (fromToken.networkId && toToken.networkId) {
      void fetchTokenPrice();
    }
  }, [fetchTokenPrice, fromToken.networkId, toToken.networkId]);

  useEffect(() => {
    if (fromToken?.networkId && fromToken?.isNative) {
      void (async () => {
        const nativeTokenConfig =
          await backgroundApiProxy.serviceSwap.fetchSwapNativeTokenConfig({
            networkId: fromToken.networkId,
          });
        setSwapNativeTokenReserveGas((pre) => {
          const find = pre.find(
            (item) => item.networkId === fromToken.networkId,
          );
          if (find) {
            return [
              ...pre.filter((item) => item.networkId !== fromToken.networkId),
              {
                networkId: fromToken.networkId,
                reserveGas: nativeTokenConfig.reserveGas,
              },
            ];
          }
          return [...pre, nativeTokenConfig];
        });
      })();
    }
  }, [fromToken?.networkId, fromToken?.isNative, setSwapNativeTokenReserveGas]);

  useEffect(() => {
    appEventBus.off(
      EAppEventBusNames.SwapSpeedBalanceUpdate,
      syncTokensBalance,
    );
    appEventBus.on(EAppEventBusNames.SwapSpeedBalanceUpdate, syncTokensBalance);
    appEventBus.off(
      EAppEventBusNames.SwapSpeedApprovingReset,
      handleSwapSpeedApprovingReset,
    );
    appEventBus.on(
      EAppEventBusNames.SwapSpeedApprovingReset,
      handleSwapSpeedApprovingReset,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapSpeedBalanceUpdate,
        syncTokensBalance,
      );
      appEventBus.off(
        EAppEventBusNames.SwapSpeedApprovingReset,
        handleSwapSpeedApprovingReset,
      );
    };
  }, [handleSwapSpeedApprovingReset, syncTokensBalance]);

  useEffect(() => {
    const fromTokenAmountDebouncedBN = new BigNumber(
      fromTokenAmountDebounced ?? 0,
    );
    if (
      (!fromTokenAmountDebouncedBN.isNaN() &&
        fromTokenAmountDebouncedBN.gt(0) &&
        !fromToken.isNative &&
        !isWrapped &&
        spenderAddress &&
        netAccountRes?.result?.address &&
        balance?.gt(0)) ||
      inAppNotificationAtom.speedSwapApprovingTransaction?.status ===
        ESwapApproveTransactionStatus.SUCCESS
    ) {
      void checkTokenApproveAllowance(fromTokenAmountDebouncedBN.toFixed());
    } else {
      setShouldApprove(false);
      setShouldResetApprove(false);
    }
  }, [
    isWrapped,
    balance,
    fromToken.isNative,
    fromTokenAmountDebounced,
    spenderAddress,
    checkTokenApproveAllowance,
    inAppNotificationAtom.speedSwapApprovingTransaction?.status,
    netAccountRes?.result?.address,
  ]);

  useEffect(() => {
    void (async () => {
      const tokenInfo =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: marketToken?.networkId,
          contractAddress: marketToken?.contractAddress,
        });
      if (tokenInfo?.length) {
        setBaseToken({
          ...tokenInfo[0],
          symbol: marketToken?.symbol,
          logoURI: tokenInfo[0]?.logoURI
            ? tokenInfo[0]?.logoURI
            : marketToken?.logoURI,
        });
      }
    })();
  }, [
    marketToken?.contractAddress,
    marketToken?.logoURI,
    marketToken?.networkId,
    marketToken?.symbol,
  ]);

  useEffect(() => {
    void syncTokensBalance({
      orderFromToken: {
        networkId: balanceToken?.networkId,
        contractAddress: balanceToken?.contractAddress,
        symbol: balanceToken?.symbol,
        decimals: balanceToken?.decimals,
        logoURI: balanceToken?.logoURI,
        name: balanceToken?.name,
        isNative: balanceToken?.isNative,
      },
    });
  }, [
    balanceToken?.contractAddress,
    balanceToken?.decimals,
    balanceToken?.isNative,
    balanceToken?.logoURI,
    balanceToken?.name,
    balanceToken?.networkId,
    balanceToken?.symbol,
    netAccountRes.result?.address,
    syncTokensBalance,
  ]);

  return {
    speedSwapBuildTx,
    speedSwapWrappedTx,
    speedSwapBuildTxLoading,
    checkTokenApproveAllowance,
    checkTokenAllowanceLoading,
    speedSwapApproveHandler,
    speedSwapApproveLoading,
    shouldApprove,
    balance,
    balanceToken,
    fetchBalanceLoading,
    swapNativeTokenReserveGas,
    priceRate,
    isWrapped,
  };
}
