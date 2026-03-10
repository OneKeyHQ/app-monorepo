import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSelectedDeriveTypeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/atoms';
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
  ISwapToken,
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
  marketToken: ISwapToken;
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
  const [fetchBalanceLoading, setFetchBalanceLoading] = useState(false);
  const [swapNativeTokenReserveGas, setSwapNativeTokenReserveGas] = useState<
    ISwapNativeTokenReserveGas[]
  >([]);
  const [{ isFirstTimeSwap }] = useSettingsPersistAtom();
  const [speedSwapApproveActionLoading, setSpeedSwapApproveActionLoading] =
    useState(false);
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
  const [speedCheckError, setSpeedCheckError] = useState('');
  const [speedCheckLoading, setSpeedCheckLoading] = useState(false);
  const [checkSpenderAddress, setCheckSpenderAddress] = useState('');
  const speedCheckRequestIdRef = useRef(0);

  const effectiveSpenderAddress = checkSpenderAddress || spenderAddress;

  const [tradeTokenDetail, setTradeTokenDetail] =
    useState<ISwapToken>(tradeToken);

  const { fromToken, toToken, balanceToken } = useMemo(() => {
    if (tradeType === ESwapDirection.BUY) {
      return {
        fromToken: tradeTokenDetail,
        toToken: marketToken,
        balanceToken: tradeTokenDetail,
      };
    }
    return {
      fromToken: marketToken,
      toToken: tradeTokenDetail,
      balanceToken: marketToken,
    };
  }, [tradeType, marketToken, tradeTokenDetail]);

  // Use atom to get selected derive type from Market Detail page
  const [selectedDeriveType] = useSelectedDeriveTypeAtom();

  const netAccountRes = usePromiseResult(async () => {
    try {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: balanceToken?.networkId ?? '',
        });

      // Prioritize Market Detail page selected derive type over global
      const effectiveDeriveType =
        selectedDeriveType ?? defaultDeriveType ?? 'default';

      const res = await backgroundApiProxy.serviceAccount.getNetworkAccount({
        accountId: account?.indexedAccount?.id
          ? undefined
          : account?.account?.id,
        indexedAccountId: account?.indexedAccount?.id ?? '',
        networkId: balanceToken?.networkId,
        deriveType: effectiveDeriveType,
      });
      return res;
    } catch (_e) {
      return undefined;
    }
  }, [account, balanceToken?.networkId, selectedDeriveType]);

  // Listen for derive type changes and re-fetch network account
  useEffect(() => {
    const handleDeriveTypeChanged = () => {
      void netAccountRes.run();
    };
    appEventBus.off(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      handleDeriveTypeChanged,
    );
    appEventBus.on(
      EAppEventBusNames.NetworkDeriveTypeChanged,
      handleDeriveTypeChanged,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.NetworkDeriveTypeChanged,
        handleDeriveTypeChanged,
      );
    };
  }, [netAccountRes]);

  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId: netAccountRes.result?.id ?? '',
    networkId: marketToken?.networkId,
  });
  const fromTokenAmountDebounced = useDebounce(fromTokenAmount, 300, {
    leading: true,
  });

  const tradeTokenRef = useRef<ISwapToken>(undefined);
  if (tradeTokenRef.current !== tradeToken) {
    tradeTokenRef.current = tradeToken;
  }
  const tradeTokenNetworkId = tradeToken.networkId;
  const tradeTokenContractAddress = tradeToken.contractAddress;
  useEffect(() => {
    void (async () => {
      if (!tradeTokenNetworkId) return;
      const tokenDetail =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: tradeTokenNetworkId,
          contractAddress: tradeTokenContractAddress,
          currency: 'usd',
        });
      if (tokenDetail?.length) {
        setTradeTokenDetail({
          ...tokenDetail[0],
          symbol: tradeTokenRef.current?.symbol ?? '',
          logoURI: tokenDetail[0]?.logoURI
            ? tokenDetail[0]?.logoURI
            : (tradeTokenRef.current?.logoURI ?? ''),
        });
      }
    })();
  }, [
    tradeType,
    defaultTradeTokens,
    tradeTokenNetworkId,
    tradeTokenContractAddress,
  ]);

  const speedSwapApproveTransactionLoading = useMemo(() => {
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
    const userAddress = netAccountRes.result?.addressDetail.address ?? '';
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
    const buildRes =
      await backgroundApiProxy.serviceSwap.fetchBuildSpeedSwapTx(buildParams);
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
            ...buildRes?.result,
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
    } catch (_e) {
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
    netAccountRes.result?.addressDetail.address,
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
    if (netAccountRes.result?.addressDetail.address) {
      const wrappedType = fromToken.isNative
        ? EWrappedType.DEPOSIT
        : EWrappedType.WITHDRAW;
      const wrappedInfo: IWrappedInfo = {
        from: netAccountRes.result?.addressDetail.address,
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
        accountAddress: netAccountRes.result?.addressDetail.address,
        receivingAddress: netAccountRes.result?.addressDetail.address,
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
    netAccountRes.result?.addressDetail.address,
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
    async (amount: string, overrideSpenderAddress?: string) => {
      const spender = overrideSpenderAddress || effectiveSpenderAddress;
      const amountBN = new BigNumber(amount || 0);
      try {
        if (
          !spender ||
          netAccountRes.result?.addressDetail.networkId !==
            fromToken.networkId ||
          !netAccountRes.result?.addressDetail.address ||
          amountBN.isZero() ||
          amountBN.isNaN() ||
          fromToken.isNative ||
          !fromToken.contractAddress ||
          isWrapped
        ) {
          setShouldApprove(false);
          setShouldResetApprove(false);
          return;
        }
        setCheckTokenAllowanceLoading(true);

        const userAddress = netAccountRes.result?.addressDetail.address ?? '';

        const fetchApproveAllowanceParams = {
          networkId: fromToken.networkId,
          tokenAddress: fromToken.contractAddress,
          spenderAddress: spender,
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
      fromToken.isNative,
      fromToken.contractAddress,
      fromToken.networkId,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.addressDetail.networkId,
      effectiveSpenderAddress,
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
        setSpeedSwapApproveActionLoading(true);
        const userAddress = netAccountRes.result?.addressDetail.address ?? '';
        const approveInfo: IApproveInfo = {
          owner: userAddress,
          spender: effectiveSpenderAddress,
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
            spenderAddress: effectiveSpenderAddress,
            status: ESwapApproveTransactionStatus.PENDING,
            kind: ESwapQuoteKind.SELL,
            resetApproveValue: !isReset ? '0' : amount,
            resetApproveIsMax: !isReset,
          },
        }));
        setSpeedSwapApproveActionLoading(false);
      } catch (_e) {
        setInAppNotificationAtom((pre) => ({
          ...pre,
          speedSwapApprovingLoading: false,
        }));
        setSpeedSwapApproveActionLoading(false);
      }
    },
    [
      setInAppNotificationAtom,
      netAccountRes.result?.addressDetail.address,
      effectiveSpenderAddress,
      navigationToTxConfirm,
      handleSpeedSwapApproveTxSuccess,
      cancelSpeedSwapApproveTx,
      antiMEV,
      provider,
    ],
  );

  const speedSwapApproveHandler = useCallback(async () => {
    if (shouldResetApprove) {
      Dialog.show({
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          void approveRun({
            spenderAddress: effectiveSpenderAddress,
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
        spenderAddress: effectiveSpenderAddress,
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
    effectiveSpenderAddress,
    toToken,
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
        netAccountRes.result?.addressDetail.address &&
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
        if (!balanceToken?.networkId) return;
        setFetchBalanceLoading(true);
        try {
          const tokenDetail =
            await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
              networkId: balanceToken?.networkId ?? '',
              contractAddress: balanceToken?.contractAddress ?? '',
              accountId: netAccountRes.result?.id ?? '',
              accountAddress: netAccountRes.result?.addressDetail.address ?? '',
              currency: 'usd',
            });
          if (tokenDetail?.length) {
            setBalance(new BigNumber(tokenDetail[0].balanceParsed ?? 0));
          }
          setFetchBalanceLoading(false);
        } catch (_e) {
          setFetchBalanceLoading(false);
        }
      } else {
        setBalance(new BigNumber(0));
      }
    },
    [
      balanceToken?.networkId,
      balanceToken?.contractAddress,
      netAccountRes.result?.addressDetail.address,
      netAccountRes.result?.id,
      netAccountRes.result?.addressDetail.networkId,
    ],
  );

  const fetchTokenPrice = useCallback(async () => {
    setPriceRate((prev) => ({
      ...prev,
      loading: true,
    }));
    if (fromToken.price && toToken.price) {
      const fromTokenPriceBN = new BigNumber(fromToken.price || 0);
      const toTokenPriceBN = new BigNumber(toToken.price || 0);
      setPriceRate({
        rate: toTokenPriceBN.isZero()
          ? 0
          : fromTokenPriceBN.dividedBy(toTokenPriceBN).toNumber(),
        fromTokenSymbol: fromToken.symbol,
        toTokenSymbol: toToken.symbol,
        loading: false,
      });
    } else {
      if (!fromToken?.networkId || !toToken?.networkId) return;
      const [fromTokenPrice, toTokenPrice] = await Promise.all([
        backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: fromToken.networkId ?? '',
          contractAddress: fromToken.contractAddress ?? '',
          currency: 'usd',
        }),
        backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: toToken.networkId ?? '',
          contractAddress: toToken.contractAddress ?? '',
          currency: 'usd',
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
          ...prev,
          loading: false,
        }));
      }
    }
  }, [
    fromToken.price,
    fromToken.symbol,
    fromToken.networkId,
    fromToken.contractAddress,
    toToken.price,
    toToken.symbol,
    toToken.networkId,
    toToken.contractAddress,
  ]);

  useEffect(() => {
    if (fromToken.networkId && toToken.networkId) {
      void fetchTokenPrice();
    }
  }, [
    fetchTokenPrice,
    fromToken.networkId,
    toToken.networkId,
    fromToken.contractAddress,
    toToken.contractAddress,
  ]);

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

  const runSpeedCheckAndAllowance = useCallback(
    async (amount: string) => {
      const amountBN = new BigNumber(amount || 0);
      if (amountBN.isNaN() || amountBN.lte(0)) {
        setSpeedCheckError('');
        setCheckSpenderAddress('');
        setShouldApprove(false);
        setShouldResetApprove(false);
        return;
      }

      speedCheckRequestIdRef.current += 1;
      const currentRequestId = speedCheckRequestIdRef.current;

      setSpeedCheckLoading(true);
      setSpeedCheckError('');
      try {
        const checkResult =
          await backgroundApiProxy.serviceSwap.fetchSpeedCheck({
            fromNetworkId: fromToken.networkId,
            toNetworkId: toToken.networkId,
            fromTokenAddress: fromToken.contractAddress,
            toTokenAddress: toToken.contractAddress,
            fromTokenAmount: amount,
            protocol: EProtocolOfExchange.SWAP,
          });

        // Discard stale response
        if (currentRequestId !== speedCheckRequestIdRef.current) {
          return;
        }

        if (checkResult?.errorMessage) {
          setSpeedCheckError(checkResult.errorMessage);
          setSpeedCheckLoading(false);
          setShouldApprove(false);
          setShouldResetApprove(false);
          return;
        }

        const newSpenderAddress = checkResult?.spenderAddress || '';
        setCheckSpenderAddress(newSpenderAddress);
        setSpeedCheckLoading(false);

        // Proceed with allowance check if non-native token
        if (
          !fromToken.isNative &&
          !isWrapped &&
          fromToken.contractAddress &&
          netAccountRes?.result?.addressDetail.address &&
          (newSpenderAddress || spenderAddress)
        ) {
          void checkTokenApproveAllowance(
            amount,
            newSpenderAddress || spenderAddress,
          );
        } else {
          setShouldApprove(false);
          setShouldResetApprove(false);
        }
      } catch (_e) {
        if (currentRequestId === speedCheckRequestIdRef.current) {
          setSpeedCheckLoading(false);
        }
      }
    },
    [
      fromToken.networkId,
      fromToken.contractAddress,
      fromToken.isNative,
      toToken.networkId,
      toToken.contractAddress,
      isWrapped,
      netAccountRes?.result?.addressDetail.address,
      spenderAddress,
      checkTokenApproveAllowance,
    ],
  );

  const runSpeedCheckAndAllowanceRef = useRef(runSpeedCheckAndAllowance);
  runSpeedCheckAndAllowanceRef.current = runSpeedCheckAndAllowance;

  useEffect(() => {
    const fromTokenAmountDebouncedBN = new BigNumber(
      fromTokenAmountDebounced || 0,
    );
    if (
      (!fromTokenAmountDebouncedBN.isNaN() &&
        fromTokenAmountDebouncedBN.gt(0) &&
        netAccountRes?.result?.addressDetail.address &&
        balance?.gt(0)) ||
      inAppNotificationAtom.speedSwapApprovingTransaction?.status ===
        ESwapApproveTransactionStatus.SUCCESS
    ) {
      void runSpeedCheckAndAllowanceRef.current(
        fromTokenAmountDebouncedBN.toFixed(),
      );
    } else {
      setSpeedCheckError('');
      setCheckSpenderAddress('');
      setShouldApprove(false);
      setShouldResetApprove(false);
    }
  }, [
    isWrapped,
    balance,
    fromToken.isNative,
    fromToken.networkId,
    fromToken.contractAddress,
    toToken.networkId,
    toToken.contractAddress,
    fromTokenAmountDebounced,
    inAppNotificationAtom.speedSwapApprovingTransaction?.status,
    netAccountRes?.result?.addressDetail.address,
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
    netAccountRes.result?.addressDetail.address,
    syncTokensBalance,
  ]);

  return {
    speedSwapBuildTx,
    speedSwapWrappedTx,
    speedSwapBuildTxLoading,
    checkTokenApproveAllowance,
    checkTokenAllowanceLoading,
    speedSwapApproveHandler,
    speedSwapApproveActionLoading,
    speedSwapApproveTransactionLoading,
    shouldApprove,
    balance,
    balanceToken,
    fetchBalanceLoading,
    swapNativeTokenReserveGas,
    priceRate,
    isWrapped,
    speedCheckError,
    speedCheckLoading,
  };
}
