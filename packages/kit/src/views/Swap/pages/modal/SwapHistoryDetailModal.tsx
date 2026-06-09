import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import Svg, { Line } from 'react-native-svg';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  Icon,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SUPPORT_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { privateSendProvider } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IExplorersInfo,
  ISwapTxHistory,
} from '@onekeyhq/shared/types/swap/types';
import {
  EExplorerType,
  EProtocolOfExchange,
  ESwapCleanHistorySource,
  ESwapCrossChainStatus,
  ESwapExtraStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';
import { EDecodedTxDirection } from '@onekeyhq/shared/types/tx';
import type { IDecodedTxTransferInfo } from '@onekeyhq/shared/types/tx';

import { AssetItem } from '../../../AssetDetails/pages/HistoryDetails';
import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';
import SwapTxHistoryViewInBrowser from '../../components/SwapHistoryTxViewInBrowser';
import SwapRateInfoItem from '../../components/SwapRateInfoItem';
import {
  getSwapCrossChainStatusTextProps,
  getSwapHistoryStatusTextProps,
} from '../../utils/utils';

import type { RouteProp } from '@react-navigation/core';
import type { LayoutChangeEvent } from 'react-native';

type ISwapHistoryDetailAssetItem = {
  name: string;
  symbol: string;
  icon: string;
  isNFT: boolean;
  isNative: boolean;
  price?: string;
  amount?: string;
};

type IPrivateSendProgressStepStatus = 'todo' | 'process' | 'done' | 'error';

const privateSendProgressStepLabels = [
  ETranslations.private_send_submitted,
  ETranslations.private_send_pending,
  ETranslations.private_send_done,
] as const;
const privateSendProgressStepLabelWidth = 72;
const privateSendProgressStepIconSize = 24;

function getPrivateSendProgressStepLabel({
  index,
  status,
}: {
  index: number;
  status: IPrivateSendProgressStepStatus;
}) {
  if (
    index === privateSendProgressStepLabels.length - 1 &&
    status === 'error'
  ) {
    return ETranslations.private_send_failed;
  }
  return (
    privateSendProgressStepLabels[index] ?? ETranslations.private_send_pending
  );
}

function getPrivateSendProgressStepStatuses({
  status,
  extraStatus,
  crossChainStatus,
}: {
  status?: ESwapTxHistoryStatus;
  extraStatus?: ESwapExtraStatus;
  crossChainStatus?: ESwapCrossChainStatus;
}): IPrivateSendProgressStepStatus[] {
  if (status === ESwapTxHistoryStatus.SUCCESS) {
    return ['done', 'done', 'done'];
  }

  if (status === ESwapTxHistoryStatus.CANCELING) {
    return ['done', 'process', 'todo'];
  }

  if (
    extraStatus === ESwapExtraStatus.HOLD ||
    crossChainStatus === ESwapCrossChainStatus.REFUNDING
  ) {
    return ['done', 'process', 'todo'];
  }

  if (
    status === ESwapTxHistoryStatus.FAILED ||
    status === ESwapTxHistoryStatus.CANCELED ||
    extraStatus === ESwapExtraStatus.EXPIRED ||
    extraStatus === ESwapExtraStatus.REFUNDED ||
    crossChainStatus === ESwapCrossChainStatus.EXPIRED ||
    crossChainStatus === ESwapCrossChainStatus.PROVIDER_ERROR ||
    crossChainStatus === ESwapCrossChainStatus.REFUNDED ||
    crossChainStatus === ESwapCrossChainStatus.REFUND_FAILED
  ) {
    return ['done', 'done', 'error'];
  }

  return ['done', 'process', 'todo'];
}

function getPrivateSendHistoryStatusTextProps({
  status,
  extraStatus,
  crossChainStatus,
}: {
  status?: ESwapTxHistoryStatus;
  extraStatus?: ESwapExtraStatus;
  crossChainStatus?: ESwapCrossChainStatus;
}) {
  if (extraStatus === ESwapExtraStatus.HOLD) {
    return getSwapHistoryStatusTextProps(
      status ?? ESwapTxHistoryStatus.PENDING,
      extraStatus,
    );
  }
  if (extraStatus === ESwapExtraStatus.EXPIRED) {
    return {
      key: ETranslations.swap_history_detail_badge_expired,
      color: '$textCritical',
    } as const;
  }
  if (extraStatus === ESwapExtraStatus.REFUNDED) {
    return {
      key: ETranslations.swap_history_detail_badge_refunded,
      color: '$textSuccess',
    } as const;
  }
  if (
    crossChainStatus === ESwapCrossChainStatus.EXPIRED ||
    crossChainStatus === ESwapCrossChainStatus.PROVIDER_ERROR ||
    crossChainStatus === ESwapCrossChainStatus.REFUNDED ||
    crossChainStatus === ESwapCrossChainStatus.REFUND_FAILED ||
    crossChainStatus === ESwapCrossChainStatus.REFUNDING
  ) {
    return getSwapCrossChainStatusTextProps(crossChainStatus);
  }
  if (
    status === ESwapTxHistoryStatus.CANCELED ||
    status === ESwapTxHistoryStatus.CANCELING
  ) {
    return getSwapHistoryStatusTextProps(status);
  }
  if (status === ESwapTxHistoryStatus.SUCCESS) {
    return {
      key: ETranslations.private_send_done,
      color: '$textSuccess',
    } as const;
  }
  if (status === ESwapTxHistoryStatus.FAILED) {
    return {
      key: ETranslations.private_send_failed,
      color: '$textCritical',
    } as const;
  }
  return {
    key: ETranslations.private_send_pending,
    color: '$textCaution',
  } as const;
}

function PrivateSendProgressStatusIcon({
  status,
}: {
  status: IPrivateSendProgressStepStatus;
}) {
  if (status === 'done') {
    return <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />;
  }

  if (status === 'error') {
    return <Icon name="XCircleSolid" size="$5" color="$iconCritical" />;
  }

  if (status === 'process') {
    return (
      <Stack
        w={privateSendProgressStepIconSize}
        h={privateSendProgressStepIconSize}
        alignItems="center"
        justifyContent="center"
      >
        <Stack
          w="$5"
          h="$5"
          borderRadius="$full"
          borderWidth={2}
          borderColor="$icon"
        />
        <Stack
          position="absolute"
          w="$2"
          h="$2"
          borderRadius="$full"
          bg="$icon"
        />
      </Stack>
    );
  }

  return (
    <Stack
      w={privateSendProgressStepIconSize}
      h={privateSendProgressStepIconSize}
      alignItems="center"
      justifyContent="center"
    >
      <Stack
        w="$5"
        h="$5"
        borderRadius="$full"
        borderWidth={2}
        borderColor="$iconDisabled"
      />
    </Stack>
  );
}

function PrivateSendProgressConnector({
  nextStepStatus,
}: {
  nextStepStatus: IPrivateSendProgressStepStatus;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const isNextStepTodo = nextStepStatus === 'todo';
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const nextWidth = e.nativeEvent.layout.width;
    setWidth((prevWidth) => (prevWidth === nextWidth ? prevWidth : nextWidth));
  }, []);

  return (
    <Stack
      flex={1}
      minWidth={0}
      height="$6"
      ml={-privateSendProgressStepIconSize}
      mr={-privateSendProgressStepIconSize}
      position="relative"
      justifyContent="center"
      onLayout={isNextStepTodo ? handleLayout : undefined}
    >
      {isNextStepTodo ? (
        <Stack position="absolute" left={0} right={0} top={0} bottom={0}>
          {width > 0 ? (
            <Svg height={privateSendProgressStepIconSize} width={width}>
              <Line
                x1={0}
                y1={privateSendProgressStepIconSize / 2}
                x2={width}
                y2={privateSendProgressStepIconSize / 2}
                stroke={theme.borderSubdued.val}
                strokeWidth={1}
                strokeDasharray="6 6"
                strokeLinecap="square"
              />
            </Svg>
          ) : null}
        </Stack>
      ) : (
        <Stack height="$px" bg="$borderSubdued" />
      )}
    </Stack>
  );
}

function PrivateSendProgressStep({
  label,
  status,
}: {
  label: ETranslations;
  status: IPrivateSendProgressStepStatus;
}) {
  const intl = useIntl();
  return (
    <Stack w={privateSendProgressStepLabelWidth} alignItems="center">
      <Stack
        w={privateSendProgressStepIconSize}
        h={privateSendProgressStepIconSize}
        alignItems="center"
        justifyContent="center"
      >
        <PrivateSendProgressStatusIcon status={status} />
      </Stack>
      <SizableText
        mt="$1"
        size="$bodySm"
        color="$textSubdued"
        width={privateSendProgressStepLabelWidth}
        numberOfLines={2}
        textAlign="center"
      >
        {intl.formatMessage({ id: label })}
      </SizableText>
    </Stack>
  );
}

function PrivateSendProgress({
  status,
  extraStatus,
  crossChainStatus,
}: {
  status?: ESwapTxHistoryStatus;
  extraStatus?: ESwapExtraStatus;
  crossChainStatus?: ESwapCrossChainStatus;
}) {
  const stepStatuses = useMemo(
    () =>
      getPrivateSendProgressStepStatuses({
        status,
        extraStatus,
        crossChainStatus,
      }),
    [crossChainStatus, extraStatus, status],
  );

  return (
    <Stack mx="$5" mb="$2.5" px="$5" py="$3" bg="$bgSubdued" borderRadius="$2">
      <XStack alignItems="flex-start">
        {stepStatuses.map((stepStatus, index) => (
          <Fragment key={`${stepStatus}-${index}`}>
            {index > 0 ? (
              <PrivateSendProgressConnector nextStepStatus={stepStatus} />
            ) : null}
            <PrivateSendProgressStep
              label={getPrivateSendProgressStepLabel({
                index,
                status: stepStatus,
              })}
              status={stepStatus}
            />
          </Fragment>
        ))}
      </XStack>
    </Stack>
  );
}

function isPrivateSendSwapTxHistory(item?: ISwapTxHistory) {
  return (
    item?.protocol === EProtocolOfExchange.PRIVATE_SEND ||
    item?.swapInfo?.provider?.provider === privateSendProvider
  );
}

type IPrivateSendHistoryCtx = {
  privateSendDisplayTransfers?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPrivateSendDisplayTransfer(
  value: unknown,
): value is IDecodedTxTransferInfo {
  return (
    isRecord(value) &&
    typeof value.amount === 'string' &&
    typeof value.symbol === 'string'
  );
}

function getPrivateSendDisplayTransfers(item?: ISwapTxHistory) {
  const transfers = (item?.ctx as IPrivateSendHistoryCtx | undefined)
    ?.privateSendDisplayTransfers;
  return Array.isArray(transfers)
    ? transfers.filter(isPrivateSendDisplayTransfer)
    : [];
}

function preservePrivateSendRouteDisplayTransfers({
  item,
  routeItem,
}: {
  item: ISwapTxHistory;
  routeItem?: ISwapTxHistory;
}) {
  if (
    !routeItem ||
    !isPrivateSendSwapTxHistory(item) ||
    !isPrivateSendSwapTxHistory(routeItem)
  ) {
    return item;
  }

  if (getPrivateSendDisplayTransfers(item).length) {
    return item;
  }

  const routeDisplayTransfers = getPrivateSendDisplayTransfers(routeItem);
  if (!routeDisplayTransfers.length) {
    return item;
  }

  return {
    ...item,
    ctx: {
      ...(isRecord(item.ctx) ? item.ctx : {}),
      privateSendDisplayTransfers: routeDisplayTransfers,
    },
  };
}

function normalizeTokenAddress(address?: string) {
  const normalized = address?.trim();
  return normalized ? normalized.toLowerCase() : '';
}

function isBasePrivateSendTransfer({
  transfer,
  txHistory,
}: {
  transfer: IDecodedTxTransferInfo;
  txHistory?: ISwapTxHistory;
}) {
  const fromToken = txHistory?.baseInfo.fromToken;
  if (!fromToken) {
    return false;
  }
  if (transfer.networkId && transfer.networkId !== fromToken.networkId) {
    return false;
  }

  const transferTokenAddress = normalizeTokenAddress(transfer.tokenIdOnNetwork);
  const fromTokenAddress = normalizeTokenAddress(fromToken.contractAddress);
  if (transferTokenAddress && fromTokenAddress) {
    return transferTokenAddress === fromTokenAddress;
  }

  return Boolean(
    (transfer.isNative || !transferTokenAddress) &&
    (fromToken.isNative || !fromTokenAddress),
  );
}

function getPositiveTokenPrice(value?: number | string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const valueBN = new BigNumber(value);
  if (valueBN.isNaN() || !valueBN.isGreaterThan(0)) {
    return undefined;
  }

  return valueBN.toFixed();
}

function getNativeTokenPriceFromGasFee(item?: ISwapTxHistory) {
  const gasFeeInNativeBN = new BigNumber(item?.txInfo.gasFeeInNative ?? '');
  const gasFeeFiatValueBN = new BigNumber(item?.txInfo.gasFeeFiatValue ?? '');

  if (
    gasFeeInNativeBN.isNaN() ||
    !gasFeeInNativeBN.isFinite() ||
    !gasFeeInNativeBN.isGreaterThan(0) ||
    gasFeeFiatValueBN.isNaN() ||
    !gasFeeFiatValueBN.isFinite() ||
    !gasFeeFiatValueBN.isGreaterThan(0)
  ) {
    return undefined;
  }

  return gasFeeFiatValueBN.div(gasFeeInNativeBN).toFixed();
}

function getPrivateSendTransferPrice({
  transfer,
  isBaseToken,
  fromAssetPrice,
  nativeTokenPrice,
}: {
  transfer: IDecodedTxTransferInfo;
  isBaseToken: boolean;
  fromAssetPrice?: string;
  nativeTokenPrice?: string;
}) {
  return (
    getPositiveTokenPrice(transfer.price) ??
    (isBaseToken ? getPositiveTokenPrice(fromAssetPrice) : undefined) ??
    (transfer.isNative ? nativeTokenPrice : undefined)
  );
}

function applyPrivateSendTokenPrice({
  item,
  price,
  force,
}: {
  item: ISwapTxHistory;
  price: string;
  force?: boolean;
}) {
  const hasFromTokenPrice = !!getPositiveTokenPrice(
    item.baseInfo.fromToken.price,
  );
  const hasToTokenPrice = !!getPositiveTokenPrice(item.baseInfo.toToken.price);

  return {
    ...item,
    baseInfo: {
      ...item.baseInfo,
      fromToken:
        hasFromTokenPrice && !force
          ? item.baseInfo.fromToken
          : { ...item.baseInfo.fromToken, price },
      toToken:
        hasToTokenPrice && !force
          ? item.baseInfo.toToken
          : { ...item.baseInfo.toToken, price },
    },
  };
}

function isSamePrivateSendHistoryToken({
  source,
  target,
}: {
  source?: ISwapTxHistory;
  target?: ISwapTxHistory;
}) {
  if (!source || !target) {
    return false;
  }
  return equalTokenNoCaseSensitive({
    token1: source.baseInfo.fromToken,
    token2: target.baseInfo.fromToken,
  });
}

function getPrivateSendPriceBackfillKey(item?: ISwapTxHistory) {
  if (!item) {
    return undefined;
  }
  const accountId = item.accountInfo.sender.accountId;
  const networkId =
    item.baseInfo.fromToken.networkId ?? item.accountInfo.sender.networkId;
  const tokenAddress = item.baseInfo.fromToken.isNative
    ? 'native'
    : item.baseInfo.fromToken.contractAddress;
  if (!accountId || !networkId || !tokenAddress) {
    return undefined;
  }
  return `${item.swapInfo.orderId ?? item.txInfo.txId ?? ''}:${accountId}:${networkId}:${tokenAddress}`;
}

async function fetchPrivateSendTokenPrice(item: ISwapTxHistory) {
  const accountId = item.accountInfo.sender.accountId;
  if (!accountId) {
    return undefined;
  }

  const networkId =
    item.baseInfo.fromToken.networkId ?? item.accountInfo.sender.networkId;
  let tokenAddress = item.baseInfo.fromToken.contractAddress;

  if (item.baseInfo.fromToken.isNative || !tokenAddress) {
    tokenAddress = await backgroundApiProxy.serviceToken.getNativeTokenAddress({
      networkId,
    });
  }

  const tokenDetails = await backgroundApiProxy.serviceToken.fetchTokensDetails(
    {
      accountId,
      networkId,
      contractList: [tokenAddress],
    },
  );

  return getPositiveTokenPrice(tokenDetails?.[0]?.price);
}

const SwapHistoryDetailModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryDetail>
    >();
  const intl = useIntl();
  const { txHistoryOrderId, txHistoryList } = route.params ?? {};
  const [txHistoryListState, setTxHistoryListState] = useState(txHistoryList);
  const privateSendPriceBackfillKeysRef = useRef(new Set<string>());
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const { result: swapTxHistoryList } = usePromiseResult(
    async () => {
      const histories =
        await backgroundApiProxy.serviceSwap.fetchSwapHistoryListFromSimple();
      return histories;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swapHistoryPendingList],
  );
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { formatDate } = useFormatDate();
  useEffect(() => {
    if (!swapTxHistoryList?.length) return;
    const routeTxHistory = txHistoryList?.find(
      (item) => item.swapInfo.orderId === txHistoryOrderId,
    );
    if (
      txHistoryOrderId &&
      !swapTxHistoryList.some(
        (item) => item.swapInfo.orderId === txHistoryOrderId,
      )
    ) {
      return;
    }
    const routeTxHistoryOrderId = routeTxHistory?.swapInfo.orderId;
    const shouldKeepRoutePrivateSendStatus =
      routeTxHistory &&
      (routeTxHistory.protocol === EProtocolOfExchange.PRIVATE_SEND ||
        routeTxHistory.swapInfo.provider.provider === privateSendProvider) &&
      routeTxHistory.status !== ESwapTxHistoryStatus.PENDING;
    const rawNextTxHistoryList = shouldKeepRoutePrivateSendStatus
      ? swapTxHistoryList.map((item) =>
          item.swapInfo.orderId === routeTxHistoryOrderId &&
          (item.status === ESwapTxHistoryStatus.PENDING ||
            item.status === ESwapTxHistoryStatus.CANCELING ||
            (routeTxHistory?.date.updated ??
              routeTxHistory?.date.created ??
              0) > (item.date.updated ?? item.date.created ?? 0))
            ? (routeTxHistory ?? item)
            : item,
        )
      : swapTxHistoryList;
    const nextRawTxHistoryList =
      routeTxHistory &&
      (routeTxHistory.protocol === EProtocolOfExchange.PRIVATE_SEND ||
        routeTxHistory.swapInfo.provider.provider === privateSendProvider)
        ? rawNextTxHistoryList.map((item) =>
            item.swapInfo.orderId === routeTxHistoryOrderId
              ? preservePrivateSendRouteDisplayTransfers({
                  item,
                  routeItem: routeTxHistory,
                })
              : item,
          )
        : rawNextTxHistoryList;
    const currentTxHistory = txHistoryListState?.find(
      (item) => item.swapInfo.orderId === txHistoryOrderId,
    );
    const currentPrivateSendPrice =
      currentTxHistory && isPrivateSendSwapTxHistory(currentTxHistory)
        ? (getPositiveTokenPrice(currentTxHistory.baseInfo.fromToken.price) ??
          getPositiveTokenPrice(currentTxHistory.baseInfo.toToken.price))
        : undefined;
    const nextTxHistoryList = currentPrivateSendPrice
      ? nextRawTxHistoryList.map((item) =>
          item.swapInfo.orderId === txHistoryOrderId &&
          isPrivateSendSwapTxHistory(item) &&
          isSamePrivateSendHistoryToken({
            source: currentTxHistory,
            target: item,
          })
            ? applyPrivateSendTokenPrice({
                item,
                price: currentPrivateSendPrice,
              })
            : item,
        )
      : nextRawTxHistoryList;
    if (
      JSON.stringify(nextTxHistoryList) !== JSON.stringify(txHistoryListState)
    ) {
      setTxHistoryListState(nextTxHistoryList);
    }
  }, [swapTxHistoryList, txHistoryList, txHistoryListState, txHistoryOrderId]);
  const txHistory = useMemo(
    () =>
      txHistoryListState?.find(
        (item) => item.swapInfo.orderId === txHistoryOrderId,
      ),
    [txHistoryListState, txHistoryOrderId],
  );
  const isPrivateSendHistory = useMemo(
    () => isPrivateSendSwapTxHistory(txHistory),
    [txHistory],
  );
  useEffect(() => {
    if (!txHistory || !isPrivateSendHistory) {
      return;
    }

    const priceBackfillKey = getPrivateSendPriceBackfillKey(txHistory);
    if (
      !priceBackfillKey ||
      privateSendPriceBackfillKeysRef.current.has(priceBackfillKey)
    ) {
      return;
    }
    privateSendPriceBackfillKeysRef.current.add(priceBackfillKey);

    let cancelled = false;
    void (async () => {
      try {
        const price = await fetchPrivateSendTokenPrice(txHistory);
        if (!price || cancelled) {
          privateSendPriceBackfillKeysRef.current.delete(priceBackfillKey);
          return;
        }

        const nextTxHistory = applyPrivateSendTokenPrice({
          item: txHistory,
          price,
          force: true,
        });
        if (JSON.stringify(nextTxHistory) === JSON.stringify(txHistory)) {
          return;
        }
        setTxHistoryListState((prev) =>
          prev?.map((item) =>
            item.swapInfo.orderId === nextTxHistory.swapInfo.orderId
              ? nextTxHistory
              : item,
          ),
        );
        await backgroundApiProxy.serviceSwap.updateSwapHistoryItem(
          nextTxHistory,
          { shouldShowToast: false },
        );
      } catch {
        privateSendPriceBackfillKeysRef.current.delete(priceBackfillKey);
        // Price backfill is best-effort and should not affect history details.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPrivateSendHistory, txHistory]);
  const shouldRenderOrderId =
    !!txHistory?.txInfo.orderId && !isPrivateSendHistory;

  const onViewInBrowser = useCallback((url: string) => {
    openUrlExternal(url);
  }, []);

  const renderSwapAssetsChange = useCallback(() => {
    const fromAsset = {
      name: txHistory?.baseInfo.fromToken.name ?? '',
      symbol: txHistory?.baseInfo.fromToken.symbol ?? '',
      icon: txHistory?.baseInfo.fromToken.logoURI ?? '',
      isNFT: false,
      isNative: !!txHistory?.baseInfo.fromToken.isNative,
      price: txHistory?.baseInfo.fromToken?.price ?? '0',
    };

    const toAsset = {
      name: txHistory?.baseInfo.toToken.name ?? '',
      symbol: txHistory?.baseInfo.toToken.symbol ?? '',
      icon: txHistory?.baseInfo.toToken.logoURI ?? '',
      isNFT: false,
      isNative: !!txHistory?.baseInfo.toToken.isNative,
      price: txHistory?.baseInfo.toToken?.price ?? '0',
    };
    let fromTokenAmount = txHistory?.baseInfo.fromAmount;
    let otherAsset: ISwapHistoryDetailAssetItem[] = [];
    if (txHistory?.swapInfo.otherFeeInfos?.length) {
      txHistory?.swapInfo.otherFeeInfos.forEach((item) => {
        const otherFeeTokenSameFromToken = equalTokenNoCaseSensitive({
          token1: item.token,
          token2: txHistory?.baseInfo.fromToken,
        });
        if (otherFeeTokenSameFromToken) {
          fromTokenAmount = new BigNumber(fromTokenAmount ?? 0)
            .plus(item.amount ?? 0)
            .toFixed();
        } else {
          otherAsset = [
            ...otherAsset,
            {
              name: item.token?.name ?? '',
              symbol: item.token?.symbol ?? '',
              icon: item.token?.logoURI ?? '',
              isNFT: false,
              isNative: !!item.token?.isNative,
              price: item.token?.price ?? '0',
              amount: item.amount,
            },
          ];
        }
      });
    }
    if (isPrivateSendHistory) {
      const privateSendDisplayTransfers =
        getPrivateSendDisplayTransfers(txHistory);
      if (privateSendDisplayTransfers.length) {
        const nativeTokenPrice = getNativeTokenPriceFromGasFee(txHistory);
        return (
          <>
            {privateSendDisplayTransfers.map((transfer, index) => {
              const isBaseToken = isBasePrivateSendTransfer({
                transfer,
                txHistory,
              });
              const asset = {
                name:
                  transfer.name ||
                  (isBaseToken
                    ? (txHistory?.baseInfo.fromToken.name ?? '')
                    : ''),
                symbol:
                  transfer.symbol ||
                  (isBaseToken
                    ? (txHistory?.baseInfo.fromToken.symbol ?? '')
                    : ''),
                icon:
                  transfer.icon ||
                  (isBaseToken
                    ? (txHistory?.baseInfo.fromToken.logoURI ?? '')
                    : ''),
                isNFT: transfer.isNFT,
                isNative: transfer.isNative,
                price: getPrivateSendTransferPrice({
                  transfer,
                  isBaseToken,
                  fromAssetPrice: fromAsset.price,
                  nativeTokenPrice,
                }),
              };

              return (
                <AssetItem
                  key={`${transfer.tokenIdOnNetwork || transfer.symbol}-${
                    transfer.amount
                  }-${index}`}
                  index={index}
                  direction={EDecodedTxDirection.OUT}
                  asset={asset}
                  isAllNetworks
                  amount={transfer.amount}
                  networkIcon={txHistory?.baseInfo.fromNetwork?.logoURI ?? ''}
                  currencySymbol={
                    txHistory?.currency ??
                    settingsPersistAtom.currencyInfo.symbol
                  }
                  networkId={
                    transfer.networkId ??
                    txHistory?.baseInfo.fromNetwork?.networkId
                  }
                />
              );
            })}
          </>
        );
      }
      return (
        <AssetItem
          index={0}
          direction={EDecodedTxDirection.OUT}
          asset={fromAsset}
          isAllNetworks
          amount={fromTokenAmount ?? '0'}
          networkIcon={txHistory?.baseInfo.fromNetwork?.logoURI ?? ''}
          currencySymbol={
            txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol
          }
        />
      );
    }
    return (
      <>
        <AssetItem
          index={0}
          direction={EDecodedTxDirection.IN}
          asset={toAsset}
          isAllNetworks
          amount={txHistory?.baseInfo.toAmount ?? '0'}
          networkIcon={txHistory?.baseInfo.toNetwork?.logoURI ?? ''}
          currencySymbol={
            txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol
          }
        />
        <AssetItem
          index={1}
          direction={EDecodedTxDirection.OUT}
          asset={fromAsset}
          isAllNetworks
          amount={fromTokenAmount ?? '0'}
          networkIcon={txHistory?.baseInfo.fromNetwork?.logoURI ?? ''}
          currencySymbol={
            txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol
          }
        />
        {otherAsset.map((item, index) => (
          <AssetItem
            key={index}
            index={index + 2}
            direction={EDecodedTxDirection.OUT}
            asset={item}
            isAllNetworks
            amount={item.amount ?? '0'}
            networkIcon={txHistory?.baseInfo.fromNetwork?.logoURI ?? ''}
            currencySymbol={
              txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol
            }
          />
        ))}
      </>
    );
  }, [
    isPrivateSendHistory,
    settingsPersistAtom.currencyInfo.symbol,
    txHistory,
  ]);

  const fromTxExplorer = useCallback(
    async (txId?: string) => {
      const logo = txHistory?.baseInfo.fromNetwork?.logoURI;
      const realTxId = txId ?? txHistory?.txInfo.txId;
      let url = '';
      if (txHistory?.baseInfo.fromNetwork?.networkId && realTxId) {
        url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
          networkId: txHistory.baseInfo.fromNetwork?.networkId,
          type: 'transaction',
          param: realTxId,
        });
      }
      return {
        name: txHistory?.baseInfo.fromNetwork?.name ?? '-',
        url,
        logo,
        status: txHistory?.status ?? ESwapTxHistoryStatus.PENDING,
        type: EExplorerType.FROM,
      } as IExplorersInfo;
    },
    [
      txHistory?.baseInfo.fromNetwork?.logoURI,
      txHistory?.baseInfo.fromNetwork?.name,
      txHistory?.baseInfo.fromNetwork?.networkId,
      txHistory?.status,
      txHistory?.txInfo.txId,
    ],
  );
  const toTxExplorer = useCallback(
    async (txId?: string) => {
      const logo = txHistory?.baseInfo.toNetwork?.logoURI;
      const realTxId = txId ?? txHistory?.txInfo.receiverTransactionId;
      let url = '';
      if (
        realTxId &&
        txHistory?.baseInfo.toNetwork?.networkId &&
        txHistory?.status === ESwapTxHistoryStatus.SUCCESS
      ) {
        url = await backgroundApiProxy.serviceExplorer.buildExplorerUrl({
          networkId: txHistory?.baseInfo.toNetwork?.networkId,
          type: 'transaction',
          param: realTxId,
        });
      }
      return {
        name: txHistory?.baseInfo.toNetwork?.name ?? '-',
        url,
        logo,
        status: txHistory?.status ?? ESwapTxHistoryStatus.PENDING,
        type: EExplorerType.TO,
      } as IExplorersInfo;
    },
    [
      txHistory?.baseInfo.toNetwork?.logoURI,
      txHistory?.baseInfo.toNetwork?.name,
      txHistory?.baseInfo.toNetwork?.networkId,
      txHistory?.status,
      txHistory?.txInfo.receiverTransactionId,
    ],
  );

  const renderSwapOrderStatus = useCallback(() => {
    const { crossChainStatus, extraStatus, status } = txHistory ?? {};
    if (isPrivateSendHistory) {
      const statusTextProps = getPrivateSendHistoryStatusTextProps({
        crossChainStatus,
        extraStatus,
        status,
      });
      return (
        <XStack gap="$2" alignItems="center">
          <SizableText size={16} color={statusTextProps.color}>
            {intl.formatMessage({ id: statusTextProps.key })}
          </SizableText>
          {txHistory?.txInfo.txId ? (
            <SwapTxHistoryViewInBrowser
              item={txHistory}
              onViewInBrowser={onViewInBrowser}
              fromTxExplorer={fromTxExplorer}
              toTxExplorer={toTxExplorer}
            />
          ) : null}
        </XStack>
      );
    }
    const { key, color } = getSwapHistoryStatusTextProps(
      status ?? ESwapTxHistoryStatus.PENDING,
      txHistory?.extraStatus,
    );
    return (
      <XStack gap="$2" alignItems="center">
        <SizableText size={16} color={color}>
          {intl.formatMessage({ id: key })}
        </SizableText>
        {txHistory?.txInfo.txId ? (
          <SwapTxHistoryViewInBrowser
            item={txHistory}
            onViewInBrowser={onViewInBrowser}
            fromTxExplorer={fromTxExplorer}
            toTxExplorer={toTxExplorer}
          />
        ) : null}
      </XStack>
    );
  }, [
    fromTxExplorer,
    intl,
    isPrivateSendHistory,
    onViewInBrowser,
    toTxExplorer,
    txHistory,
  ]);

  const renderSwapCrossChainStatus = useCallback(() => {
    const { crossChainStatus } = txHistory ?? {};
    const { key, color } = getSwapCrossChainStatusTextProps(
      crossChainStatus ?? ESwapCrossChainStatus.FROM_PENDING,
    );
    return (
      <XStack gap="$2" alignItems="center">
        <SizableText size={16} color={color}>
          {intl.formatMessage({ id: key })}
        </SizableText>
        {txHistory?.swapOrderHash?.refundHash ? (
          <XStack
            onPress={async () => {
              const explorerInfo = await fromTxExplorer(
                txHistory?.swapOrderHash?.refundHash,
              );
              if (explorerInfo.url) {
                onViewInBrowser(explorerInfo.url);
              }
            }}
            cursor="pointer"
            alignItems="center"
            justifyContent="center"
          >
            <Icon
              name="OpenOutline"
              size="$4.5"
              flex={1}
              alignSelf="center"
              color="$iconSubdued"
            />
          </XStack>
        ) : null}
      </XStack>
    );
  }, [fromTxExplorer, intl, onViewInBrowser, txHistory]);
  const renderSwapDate = useCallback(() => {
    const { created } = txHistory?.date ?? {};
    const dateObj = new Date(created ?? 0);
    const dateStr = formatDate(dateObj);
    return (
      <SizableText size={14} color="$textSubdued">
        {dateStr}
      </SizableText>
    );
  }, [formatDate, txHistory?.date]);

  const renderSwapProvider = useCallback(
    () => (
      <XStack alignItems="center" gap="$1">
        {txHistory?.swapInfo.provider.providerLogo ? (
          <Stack position="relative" w="$5" h="$5">
            <Image
              source={{ uri: txHistory.swapInfo.provider.providerLogo }}
              w="$5"
              h="$5"
              borderRadius="$1"
            />
            <Stack
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              borderRadius="$1"
              borderWidth="$px"
              borderColor="$borderSubdued"
              pointerEvents="none"
            />
          </Stack>
        ) : null}
        <SizableText size="$bodyLg" color="$textSubdued">
          {txHistory?.swapInfo.provider.providerName ?? ''}
        </SizableText>
      </XStack>
    ),
    [
      txHistory?.swapInfo.provider.providerLogo,
      txHistory?.swapInfo.provider.providerName,
    ],
  );

  const renderNetworkFee = useCallback(() => {
    const { gasFeeFiatValue, gasFeeInNative } = txHistory?.txInfo ?? {};
    const gasFeeInNativeBN = new BigNumber(gasFeeInNative ?? '');
    const gasFeeFiatValueBN = new BigNumber(gasFeeFiatValue ?? '');
    if (gasFeeInNativeBN.isNaN() || !gasFeeInNativeBN.isFinite()) {
      return (
        <SizableText size="$bodyMd" color="$textSubdued">
          --
        </SizableText>
      );
    }
    const gasFeeDisplay = gasFeeInNativeBN.toFixed();
    const shouldRenderGasFeeFiatValue =
      !gasFeeFiatValueBN.isNaN() && gasFeeFiatValueBN.isFinite();
    return (
      <SizableText size="$bodyMd" color="$textSubdued">
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="balance"
        >
          {gasFeeDisplay}
        </NumberSizeableText>
        {` ${txHistory?.baseInfo.fromNetwork?.symbol ?? ''}`}(
        <NumberSizeableText
          color="$textSubdued"
          size="$bodyMd"
          formatter="value"
          formatterOptions={{
            currency:
              txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol,
          }}
        >
          {shouldRenderGasFeeFiatValue ? gasFeeFiatValue : '--'}
        </NumberSizeableText>
        )
      </SizableText>
    );
  }, [
    settingsPersistAtom.currencyInfo.symbol,
    txHistory?.baseInfo.fromNetwork?.symbol,
    txHistory?.currency,
    txHistory?.txInfo,
  ]);

  const renderRate = useCallback(
    () => (
      <SwapRateInfoItem
        rate={txHistory?.swapInfo.instantRate ?? '0'}
        fromToken={txHistory?.baseInfo.fromToken}
        toToken={txHistory?.baseInfo.toToken}
      />
    ),
    [
      txHistory?.baseInfo.fromToken,
      txHistory?.baseInfo.toToken,
      txHistory?.swapInfo.instantRate,
    ],
  );

  const renderProtocolFee = useCallback(() => {
    const protocolFee = txHistory?.swapInfo.protocolFee;
    const protocolFeeBN = new BigNumber(protocolFee ?? 0);
    const positiveOtherFeeInfos = txHistory?.swapInfo.otherFeeInfos?.filter(
      (item) => {
        const amountBN = new BigNumber(item.amount ?? 0);
        return !amountBN.isNaN() && amountBN.gt(0);
      },
    );

    if (positiveOtherFeeInfos?.length && protocolFeeBN.isZero()) {
      return (
        <Stack alignItems="flex-end" gap="$1">
          {positiveOtherFeeInfos.map((item, index) => (
            <SizableText
              key={`${item.token.networkId}-${item.token.contractAddress}-${index}`}
              size="$bodyMd"
              color="$textSubdued"
            >
              <NumberSizeableText
                size="$bodyMd"
                color="$textSubdued"
                formatter="balance"
              >
                {item.amount}
              </NumberSizeableText>
              {` ${item.token.symbol}`}
            </SizableText>
          ))}
        </Stack>
      );
    }

    if (isNil(protocolFee)) {
      return null;
    }

    return (
      <NumberSizeableText
        size="$bodyMd"
        color="$textSubdued"
        formatter="value"
        formatterOptions={{
          currency:
            txHistory?.currency ?? settingsPersistAtom.currencyInfo.symbol,
        }}
      >
        {protocolFee.toString()}
      </NumberSizeableText>
    );
  }, [
    settingsPersistAtom.currencyInfo.symbol,
    txHistory?.currency,
    txHistory?.swapInfo.otherFeeInfos,
    txHistory?.swapInfo.protocolFee,
  ]);

  const renderSwapHistoryDetails = useCallback(() => {
    if (!txHistory) {
      return null;
    }
    const protocolFeeContent = renderProtocolFee();
    const shouldRenderReceiver =
      !isPrivateSendHistory || Boolean(txHistory.txInfo.receiver);

    return (
      <>
        <Stack>{renderSwapAssetsChange()}</Stack>
        {isPrivateSendHistory ? (
          <PrivateSendProgress
            status={txHistory.status}
            extraStatus={txHistory.extraStatus}
            crossChainStatus={txHistory.crossChainStatus}
          />
        ) : null}
        <Stack>
          <InfoItemGroup>
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_order_status,
              })}
              renderContent={renderSwapOrderStatus()}
              compactAll
            />
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_date,
              })}
              renderContent={renderSwapDate()}
              compactAll
            />
            {txHistory?.crossChainStatus ? (
              <InfoItem
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_order_detail,
                })}
                renderContent={renderSwapCrossChainStatus()}
                compactAll
              />
            ) : null}
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              label={intl.formatMessage({
                id: isPrivateSendHistory
                  ? ETranslations.global_from
                  : ETranslations.swap_history_detail_pay_address,
              })}
              renderContent={txHistory.txInfo.sender}
              showCopy
              description={
                <AddressInfo
                  address={txHistory.txInfo.sender}
                  networkId={txHistory.accountInfo?.sender.networkId}
                  accountId={txHistory.accountInfo?.sender.accountId}
                />
              }
            />
            {shouldRenderReceiver ? (
              <InfoItem
                label={intl.formatMessage({
                  id: isPrivateSendHistory
                    ? ETranslations.global_to
                    : ETranslations.swap_history_detail_received_address,
                })}
                renderContent={txHistory.txInfo.receiver}
                description={
                  <AddressInfo
                    address={txHistory.txInfo.receiver}
                    networkId={txHistory.accountInfo?.receiver.networkId}
                    accountId={txHistory.accountInfo?.receiver.accountId}
                  />
                }
                showCopy
              />
            ) : null}
            {txHistory.txInfo.txId ? (
              <InfoItem
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_transaction_hash,
                })}
                renderContent={txHistory.txInfo.txId}
                showCopy
              />
            ) : null}
            <InfoItem
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_network_fee,
              })}
              renderContent={renderNetworkFee()}
            />
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              disabledCopy
              label={intl.formatMessage({
                id: ETranslations.swap_history_detail_provider,
              })}
              renderContent={renderSwapProvider()}
            />
            {shouldRenderOrderId ? (
              <InfoItem
                label="Order ID"
                renderContent={txHistory.txInfo.orderId}
                showCopy
                {...(txHistory.swapInfo.orderSupportUrl
                  ? {
                      openWithUrl: () =>
                        onViewInBrowser(
                          `${txHistory.swapInfo.orderSupportUrl ?? ''}${
                            txHistory.txInfo.orderId ?? ''
                          }`,
                        ),
                    }
                  : {})}
              />
            ) : null}
            {isPrivateSendHistory ? null : (
              <InfoItem
                disabledCopy
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_rate,
                })}
                renderContent={renderRate()}
              />
            )}
            {!isPrivateSendHistory && protocolFeeContent ? (
              <InfoItem
                disabledCopy
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_protocol_fee,
                })}
                renderContent={protocolFeeContent}
              />
            ) : null}

            {!isPrivateSendHistory && txHistory?.swapInfo?.surplus ? (
              <InfoItem
                disabledCopy
                label={intl.formatMessage({
                  id: ETranslations.swap_history_detail_surplus,
                })}
                renderContent={`${txHistory.swapInfo.surplus} ${txHistory.baseInfo.toToken.symbol}`}
              />
            ) : null}
          </InfoItemGroup>
        </Stack>
      </>
    );
  }, [
    intl,
    onViewInBrowser,
    renderNetworkFee,
    renderProtocolFee,
    renderRate,
    renderSwapAssetsChange,
    renderSwapCrossChainStatus,
    renderSwapDate,
    renderSwapOrderStatus,
    renderSwapProvider,
    shouldRenderOrderId,
    isPrivateSendHistory,
    txHistory,
  ]);

  const onDeleteOneHistory = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_history_detail_clear_title,
      }),
      onConfirm: async () => {
        await backgroundApiProxy.serviceSwap.cleanOneSwapHistory(
          txHistory?.txInfo ?? {},
        );
        void backgroundApiProxy.serviceApp.showToast({
          method: 'success',
          title: intl.formatMessage({
            id: ETranslations.settings_clear_successful,
          }),
        });
        defaultLogger.swap.cleanSwapOrder.cleanSwapOrder({
          cleanFrom: ESwapCleanHistorySource.DETAIL,
        });
        navigation.pop();
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_clear,
      }),
      onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
    });
  }, [intl, navigation, txHistory?.txInfo]);

  const headerRight = useCallback(
    () => (
      <Button
        variant="tertiary"
        onPress={onDeleteOneHistory}
        testID="swap-header-right-btn"
      >
        {intl.formatMessage({ id: ETranslations.global_clear })}
      </Button>
    ),
    [intl, onDeleteOneHistory],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: isPrivateSendHistory
            ? ETranslations.private_send_private_send
            : ETranslations.swap_history_detail_title,
        })}
        headerRight={headerRight}
      />
      <Page.Body>{renderSwapHistoryDetails()}</Page.Body>
      {txHistory?.swapInfo.supportUrl ? (
        <Page.Footer
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_support,
          })}
          confirmButtonProps={{
            icon: 'BubbleAnnotationOutline',
            variant: 'secondary',
          }}
          onConfirm={() => {
            if (txHistory?.swapInfo.supportUrl?.includes(SUPPORT_URL)) {
              void showIntercom();
            } else {
              onViewInBrowser(txHistory?.swapInfo.supportUrl ?? '');
            }
          }}
        />
      ) : null}
    </Page>
  );
};

export default SwapHistoryDetailModal;
