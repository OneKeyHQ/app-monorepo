import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import * as Clipboard from 'expo-clipboard';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import Share from '@onekeyhq/shared/src/modules3rdParty/react-native-share';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EExchangeProtocol,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapTxHistory,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useFormatDate from '../../../hooks/useFormatDate';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { ETabRoutes } from '../../../routes/Tab/type';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapTxHistoryAtom,
  useSwapTxHistoryPendingAtom,
} from '../../../states/jotai/contexts/swap';

import type ViewShot from 'react-native-view-shot';

export function useSwapTxHistoryListSyncFromSimpleDb() {
  const [, setSwapHistory] = useSwapTxHistoryAtom();
  const { isLoading } = usePromiseResult(
    async () => {
      const histories =
        await backgroundApiProxy.simpleDb.swapHistory.getSwapHistoryList();
      const sortHistories = histories.sort(
        (a, b) => b.date.created - a.date.created,
      );
      setSwapHistory(sortHistories);
    },
    [setSwapHistory],
    {
      watchLoading: true,
    },
  );
  return { syncLoading: isLoading };
}

export function useSwapTxHistoryStateSyncInterval() {
  const [swapTxHistoryPending] = useSwapTxHistoryPendingAtom();
  const { updateSwapHistoryItem } = useSwapActions().current;
  const internalRef = useRef<Record<string, NodeJS.Timeout>>({});
  const swapTxHistoryPendingRef = useRef<ISwapTxHistory[]>([]);
  if (swapTxHistoryPendingRef.current !== swapTxHistoryPending) {
    swapTxHistoryPendingRef.current = swapTxHistoryPending;
  }
  const triggerSwapPendingHistoryInterval = useCallback(() => {
    if (swapTxHistoryPendingRef.current.length > 0) {
      swapTxHistoryPendingRef.current.forEach(async (swapTxHistory) => {
        if (!internalRef.current[swapTxHistory.txInfo.txId]) {
          const interval = setInterval(async () => {
            const txStatusRes =
              await backgroundApiProxy.serviceSwap.fetchTxState({
                txId: swapTxHistory.txInfo.txId,
                provider: swapTxHistory.swapInfo.provider.provider,
                protocol: EExchangeProtocol.SWAP,
                networkId: swapTxHistory.baseInfo.fromToken.networkId,
                ctx: swapTxHistory.ctx,
                toTokenAddress: swapTxHistory.baseInfo.toToken.contractAddress,
              });
            if (txStatusRes.state !== ESwapTxHistoryStatus.PENDING) {
              clearInterval(interval);
              delete internalRef.current[swapTxHistory.txInfo.txId];
              await updateSwapHistoryItem({
                ...swapTxHistory,
                status: txStatusRes.state,
                txInfo: {
                  ...swapTxHistory.txInfo,
                  receiverTransactionId:
                    txStatusRes.crossChainReceiveTxHash || '',
                  gasFeeInNative: txStatusRes.gasFee
                    ? txStatusRes.gasFee
                    : swapTxHistory.txInfo.gasFeeInNative,
                  gasFeeFiatValue: txStatusRes.gasFeeFiatValue
                    ? txStatusRes.gasFeeFiatValue
                    : swapTxHistory.txInfo.gasFeeFiatValue,
                },
                baseInfo: {
                  ...swapTxHistory.baseInfo,
                  toAmount: txStatusRes.dealReceiveAmount
                    ? txStatusRes.dealReceiveAmount
                    : swapTxHistory.baseInfo.toAmount,
                },
              });
            }
          }, 1000 * 5);
          internalRef.current[swapTxHistory.txInfo.txId] = interval;
        }
      });
    }
  }, [updateSwapHistoryItem]);

  const cleanupSwapPendingHistoryInterval = useCallback(() => {
    const currentInternalRef = internalRef.current;
    Object.entries(currentInternalRef).forEach(([key, value]) => {
      clearInterval(value);
      delete currentInternalRef[key];
    });
  }, []);

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (isFocus && !isHiddenModel) {
        triggerSwapPendingHistoryInterval();
      } else {
        cleanupSwapPendingHistoryInterval();
      }
    },
  );

  useEffect(() => {
    triggerSwapPendingHistoryInterval();
    return () => {
      cleanupSwapPendingHistoryInterval();
    };
  }, [cleanupSwapPendingHistoryInterval, triggerSwapPendingHistoryInterval]);
  return {
    swapTxHistoryPending,
  };
}

export function useSwapTxHistoryActions() {
  const { addSwapHistoryItem } = useSwapActions().current;
  const [swapNetworks] = useSwapNetworksAtom();
  const [, setFromToken] = useSwapSelectFromTokenAtom();
  const [, setToken] = useSwapSelectToTokenAtom();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const generateSwapHistoryItem = useCallback(
    async ({
      txId,
      gasFeeInNative,
      gasFeeFiatValue,
      swapTxInfo,
    }: {
      txId: string;
      gasFeeInNative?: string;
      gasFeeFiatValue?: string;
      swapTxInfo: ISwapTxInfo;
    }) => {
      if (swapTxInfo) {
        const swapHistoryItem: ISwapTxHistory = {
          status: ESwapTxHistoryStatus.PENDING,
          baseInfo: {
            toAmount: swapTxInfo.receiver.amount,
            fromAmount: swapTxInfo.sender.amount,
            fromToken: swapTxInfo.sender.token,
            toToken: swapTxInfo.receiver.token,
            fromNetwork: swapNetworks.find(
              (item) => item?.networkId === swapTxInfo.sender.token.networkId,
            ),
            toNetwork: swapNetworks.find(
              (item) => item?.networkId === swapTxInfo.receiver.token.networkId,
            ),
          },
          txInfo: {
            txId,
            gasFeeFiatValue,
            gasFeeInNative,
            sender: swapTxInfo.accountAddress,
            receiver: swapTxInfo.receivingAddress,
          },
          date: {
            created: Date.now(),
            updated: Date.now(),
          },
          swapInfo: {
            instantRate: swapTxInfo.swapBuildResData.result.instantRate,
            provider: swapTxInfo.swapBuildResData.result.info,
          },
          ctx: swapTxInfo.swapBuildResData.ctx,
        };
        await addSwapHistoryItem(swapHistoryItem);
      }
    },
    [addSwapHistoryItem, swapNetworks],
  );

  const swapAgainUseHistoryItem = useCallback(
    (item: ISwapTxHistory) => {
      setFromToken(item?.baseInfo.fromToken);
      setToken(item?.baseInfo.toToken);
      setFromTokenAmount(item?.baseInfo.fromAmount);
    },
    [setFromToken, setFromTokenAmount, setToken],
  );
  return { generateSwapHistoryItem, swapAgainUseHistoryItem };
}

export function useSwapTxHistoryDetailParser(item: ISwapTxHistory) {
  const intl = useIntl();
  const { formatDate } = useFormatDate();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const statusLabel = useMemo(() => {
    if (item?.status === ESwapTxHistoryStatus.FAILED) {
      return intl.formatMessage({ id: 'transaction__failed' });
    }
    if (item?.status === ESwapTxHistoryStatus.SUCCESS) {
      return intl.formatMessage({ id: 'transaction__success' });
    }
    return intl.formatMessage({ id: 'transaction__pending' });
  }, [intl, item?.status]);

  const usedTime = useMemo(() => {
    if (!item || item?.status === ESwapTxHistoryStatus.PENDING) {
      return '';
    }
    const { created, updated } = item.date;
    const usedTimeMinusRes = new BigNumber(updated)
      .minus(new BigNumber(created))
      .dividedBy(1000)
      .dividedBy(60)
      .decimalPlaces(0, BigNumber.ROUND_UP)
      .toFixed(0);
    return `${usedTimeMinusRes} minutes used`;
  }, [item]);

  const createDateTime = useMemo(() => {
    const date = new Date(item?.date.created);
    return formatDate(date);
  }, [formatDate, item?.date.created]);

  const updateDateTime = useMemo(() => {
    const date = new Date(item?.date.updated);
    return formatDate(date);
  }, [formatDate, item?.date.updated]);

  const networkFee = useMemo(() => {
    const gasFeeInNativeParse = new BigNumber(item?.txInfo?.gasFeeInNative ?? 0)
      .decimalPlaces(6, BigNumber.ROUND_DOWN)
      .toFixed();
    const gasFeeFiatValueParse = new BigNumber(
      item?.txInfo?.gasFeeFiatValue ?? 0,
    )
      .decimalPlaces(6, BigNumber.ROUND_DOWN)
      .toFixed();
    const gasFeeInNativeDisplay = gasFeeInNativeParse
      ? `${gasFeeInNativeParse} ${item?.baseInfo.fromNetwork?.symbol ?? ''}`
      : '';
    const gasFeeFiatValueDisplay = gasFeeFiatValueParse
      ? `(${settingsPersistAtom.currencyInfo.symbol}${gasFeeFiatValueParse})`
      : '';
    return { gasFeeFiatValueDisplay, gasFeeInNativeDisplay };
  }, [
    item?.baseInfo.fromNetwork?.symbol,
    item?.txInfo?.gasFeeFiatValue,
    item?.txInfo?.gasFeeInNative,
    settingsPersistAtom.currencyInfo.symbol,
  ]);

  // todo protocolFee currency symbol
  const protocolFee = useMemo(
    () => (item?.swapInfo?.protocolFee ? `$${item?.swapInfo.protocolFee}` : ''),
    [item?.swapInfo.protocolFee],
  );

  const oneKeyFee = useMemo(
    () => (item?.swapInfo.oneKeyFee ? `${item?.swapInfo.oneKeyFee}%` : ''),
    [item?.swapInfo.oneKeyFee],
  );

  const onCopyDetailInfo = useCallback(async () => {
    const detailInfo = `${statusLabel}\n${usedTime}\n${
      item?.baseInfo.fromAmount
    }${item?.baseInfo.fromToken.symbol}(${
      item?.baseInfo.fromNetwork?.name ?? '-'
    })\n${item?.baseInfo.toAmount}${item?.baseInfo.toToken.symbol}(${
      item?.baseInfo.toNetwork?.name ?? '-'
    })\nON-CHAIN INFO\n${intl.formatMessage({ id: 'action__send' })} ${
      item?.txInfo.sender
    }\n${intl.formatMessage({ id: 'action__receive' })} ${
      item?.txInfo.receiver
    }\n${intl.formatMessage({ id: 'content__hash' })} ${
      item?.txInfo.txId
    }\n${intl.formatMessage({
      id: 'form__network_fee',
    })} ${networkFee.gasFeeInNativeDisplay} ${
      networkFee.gasFeeFiatValueDisplay
    }\nSWAP INFO\n${intl.formatMessage({
      id: 'form__rate',
    })} 1 ${item?.baseInfo.fromToken.symbol} = ${item?.swapInfo.instantRate} ${
      item?.baseInfo.toToken.symbol
    }\nProvider ${
      item?.swapInfo.provider.providerName
    }\nProtocol Fee ${protocolFee}\nOneKey Fee ${oneKeyFee}\nCreated ${createDateTime}\nUpdated ${updateDateTime}`;
    await Clipboard.setStringAsync(detailInfo);
    Toast.success({ title: 'sucess', message: 'copy success' });
  }, [
    statusLabel,
    item,
    intl,
    usedTime,
    createDateTime,
    updateDateTime,
    oneKeyFee,
    networkFee,
    protocolFee,
  ]);
  return {
    statusLabel,
    usedTime,
    onCopyDetailInfo,
    createDateTime,
    updateDateTime,
    networkFee,
    protocolFee,
    oneKeyFee,
  };
}

export function useSwapTxHistoryShare() {
  const captureViewRef = useRef<ViewShot>(null);
  const enableShare = useMemo(() => platformEnv.isNative, []);
  const onShare = useCallback(async () => {
    if (captureViewRef.current) {
      const uri = await captureViewRef.current.capture?.();
      // todo share
      if (uri && enableShare) {
        // Sharing.shareAsync(`file://${uri}`);
        await Share.open({ url: uri });
      }
      // Sharing.shareAsync(`file://${uri}`, options);
      Toast.success({ title: 'sucess', message: 'copy success' });
    }
  }, [enableShare]);

  return { onShare, captureViewRef, enableShare };
}
