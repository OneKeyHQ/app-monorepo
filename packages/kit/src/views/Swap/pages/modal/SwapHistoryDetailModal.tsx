import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

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
  Spinner,
  Stack,
  XStack,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AddressInfo } from '@onekeyhq/kit/src/components/AddressInfo';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useCurrencyPersistAtom,
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { SUPPORT_URL } from '@onekeyhq/shared/src/config/appConfig';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
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

type IPrivateSendDisplayPriceTarget = {
  key?: string;
  networkId?: string;
  tokenAddress?: string;
  isNative?: boolean;
};

type IPrivateSendProgressStepStatus = 'todo' | 'process' | 'done' | 'error';

const privateSendProgressStepLabels = [
  ETranslations.private_send_submitted,
  ETranslations.private_send_pending,
  ETranslations.private_send_done,
] as const;
const privateSendProgressStepLabelWidth = 72;
const privateSendProgressStepIconSize = 24;
const privateSendProgressStepCircleSize = 20;
const privateSendProgressStepCircleInset =
  (privateSendProgressStepIconSize - privateSendProgressStepCircleSize) / 2;
const privateSendProgressConnectorIconGap = 4;

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
    return <Icon name="CheckRadioSolid" size="$6" color="$iconSuccess" />;
  }

  if (status === 'error') {
    return <Icon name="XCircleSolid" size="$6" color="$iconCritical" />;
  }

  if (status === 'process') {
    return (
      <Stack
        w={privateSendProgressStepIconSize}
        h={privateSendProgressStepIconSize}
        alignItems="center"
        justifyContent="center"
      >
        <Spinner
          size="small"
          color="$textCaution"
          w={privateSendProgressStepCircleSize}
          h={privateSendProgressStepCircleSize}
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
        w={privateSendProgressStepCircleSize}
        h={privateSendProgressStepCircleSize}
        borderRadius="$full"
        borderWidth={2}
        borderColor="$iconDisabled"
      />
    </Stack>
  );
}

function PrivateSendProgressConnector({
  index,
  nextStepStatus,
  total,
}: {
  index: number;
  nextStepStatus: IPrivateSendProgressStepStatus;
  total: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const isNextStepTodo = nextStepStatus === 'todo';
  const prevStepIndex = index - 1;
  const getStepIconLeft = (stepIndex: number) => {
    if (stepIndex === 0) {
      return 0;
    }
    if (stepIndex === total - 1) {
      return (
        privateSendProgressStepLabelWidth - privateSendProgressStepIconSize
      );
    }
    return (
      (privateSendProgressStepLabelWidth - privateSendProgressStepIconSize) / 2
    );
  };
  const prevCircleRight =
    getStepIconLeft(prevStepIndex) +
    privateSendProgressStepCircleInset +
    privateSendProgressStepCircleSize;
  const nextCircleLeft =
    getStepIconLeft(index) + privateSendProgressStepCircleInset;
  const marginLeft =
    prevCircleRight +
    privateSendProgressConnectorIconGap -
    privateSendProgressStepLabelWidth;
  const marginRight = privateSendProgressConnectorIconGap - nextCircleLeft;
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const nextWidth = e.nativeEvent.layout.width;
    setWidth((prevWidth) => (prevWidth === nextWidth ? prevWidth : nextWidth));
  }, []);

  return (
    <Stack
      flex={1}
      minWidth={0}
      height="$6"
      ml={marginLeft}
      mr={marginRight}
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
                strokeWidth={2}
                strokeDasharray="6 6"
                strokeLinecap="square"
              />
            </Svg>
          ) : null}
        </Stack>
      ) : (
        <Stack height={2} bg="$borderSubdued" />
      )}
    </Stack>
  );
}

function PrivateSendProgressStep({
  index,
  label,
  status,
  total,
}: {
  index: number;
  label: ETranslations;
  status: IPrivateSendProgressStepStatus;
  total: number;
}) {
  const intl = useIntl();
  const isFirst = index === 0;
  const isLast = index === total - 1;
  let alignItems: 'flex-start' | 'center' | 'flex-end' = 'center';
  let textAlign: 'left' | 'center' | 'right' = 'center';
  if (isFirst) {
    alignItems = 'flex-start';
    textAlign = 'left';
  } else if (isLast) {
    alignItems = 'flex-end';
    textAlign = 'right';
  }

  return (
    <Stack w={privateSendProgressStepLabelWidth} alignItems={alignItems}>
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
        size="$bodySmMedium"
        color="$textSubdued"
        width={privateSendProgressStepLabelWidth}
        numberOfLines={2}
        textAlign={textAlign}
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
    <Stack
      mx="$5"
      mb="$2.5"
      px="$4"
      py="$3"
      bg="$bgSubdued"
      borderRadius="$2.5"
    >
      <XStack alignItems="flex-start">
        {stepStatuses.map((stepStatus, index) => (
          <Fragment key={`${stepStatus}-${index}`}>
            {index > 0 ? (
              <PrivateSendProgressConnector
                index={index}
                nextStepStatus={stepStatus}
                total={stepStatuses.length}
              />
            ) : null}
            <PrivateSendProgressStep
              index={index}
              label={getPrivateSendProgressStepLabel({
                index,
                status: stepStatus,
              })}
              status={stepStatus}
              total={stepStatuses.length}
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

function getPrivateSendDisplayPriceKey({
  networkId,
  tokenAddress,
  isNative,
}: {
  networkId?: string;
  tokenAddress?: string;
  isNative?: boolean;
}) {
  if (!networkId) {
    return undefined;
  }
  if (isNative) {
    return `${networkId}:native`;
  }
  if (!tokenAddress) {
    return undefined;
  }
  return `${networkId}:${tokenAddress.toLowerCase()}`;
}

function getPrivateSendBaseTokenPriceKey(item?: ISwapTxHistory) {
  return getPrivateSendDisplayPriceKey({
    networkId:
      item?.baseInfo.fromToken.networkId ??
      item?.baseInfo.fromNetwork?.networkId ??
      item?.accountInfo.sender.networkId,
    tokenAddress: item?.baseInfo.fromToken.contractAddress,
    isNative: item?.baseInfo.fromToken.isNative,
  });
}

function getPrivateSendNetworkNativePriceKey(item?: ISwapTxHistory) {
  return getPrivateSendDisplayPriceKey({
    networkId:
      item?.baseInfo.fromNetwork?.networkId ??
      item?.accountInfo.sender.networkId,
    isNative: true,
  });
}

function getPrivateSendTransferPriceKey({
  transfer,
  item,
}: {
  transfer: IDecodedTxTransferInfo;
  item?: ISwapTxHistory;
}) {
  const isBaseToken = isBasePrivateSendTransfer({
    transfer,
    txHistory: item,
  });
  return getPrivateSendDisplayPriceKey({
    networkId:
      transfer.networkId ??
      item?.baseInfo.fromNetwork?.networkId ??
      item?.accountInfo.sender.networkId,
    tokenAddress:
      transfer.tokenIdOnNetwork ||
      (isBaseToken ? item?.baseInfo.fromToken.contractAddress : undefined),
    isNative:
      transfer.isNative || (isBaseToken && item?.baseInfo.fromToken.isNative),
  });
}

function convertPrivateSendTokenDisplayPrice({
  price,
  sourceCurrency,
  targetCurrency,
  currencyMap,
}: {
  price?: number | string;
  sourceCurrency?: string;
  targetCurrency: string;
  currencyMap: Record<string, ICurrencyItem>;
}) {
  const validPrice = getPositiveTokenPrice(price);
  if (!validPrice) {
    return undefined;
  }

  const resolvedSourceCurrency = sourceCurrency || USD_CURRENCY_ID;
  if (
    resolvedSourceCurrency !== targetCurrency &&
    (!currencyMap[resolvedSourceCurrency] || !currencyMap[targetCurrency])
  ) {
    return undefined;
  }

  return convertFiat({
    value: validPrice,
    sourceCurrency: resolvedSourceCurrency,
    targetCurrency,
    currencyMap,
  });
}

async function fetchPrivateSendTokenDisplayPriceMap({
  item,
  targetCurrency,
  currencyMap,
}: {
  item: ISwapTxHistory;
  targetCurrency: string;
  currencyMap: Record<string, ICurrencyItem>;
}) {
  const accountId = item.accountInfo.sender.accountId;
  if (!accountId) {
    return {};
  }

  const displayTransfers = getPrivateSendDisplayTransfers(item);
  const displayTargets: IPrivateSendDisplayPriceTarget[] =
    displayTransfers.length
      ? displayTransfers.map((transfer) => {
          const isBaseToken = isBasePrivateSendTransfer({
            transfer,
            txHistory: item,
          });
          return {
            key: getPrivateSendTransferPriceKey({ transfer, item }),
            networkId:
              transfer.networkId ??
              item.baseInfo.fromNetwork?.networkId ??
              item.accountInfo.sender.networkId,
            tokenAddress:
              transfer.tokenIdOnNetwork ||
              (isBaseToken
                ? item.baseInfo.fromToken.contractAddress
                : undefined),
            isNative:
              transfer.isNative ||
              (isBaseToken && item.baseInfo.fromToken.isNative),
          };
        })
      : [
          {
            key: getPrivateSendBaseTokenPriceKey(item),
            networkId:
              item.baseInfo.fromToken.networkId ??
              item.baseInfo.fromNetwork?.networkId ??
              item.accountInfo.sender.networkId,
            tokenAddress: item.baseInfo.fromToken.contractAddress,
            isNative: item.baseInfo.fromToken.isNative,
          },
        ];
  const nativePriceKey = getPrivateSendNetworkNativePriceKey(item);
  const nativeNetworkId =
    item.baseInfo.fromNetwork?.networkId ?? item.accountInfo.sender.networkId;
  const targets =
    nativePriceKey && nativeNetworkId
      ? [
          ...displayTargets,
          {
            key: nativePriceKey,
            networkId: nativeNetworkId,
            isNative: true,
          },
        ]
      : displayTargets;

  const priceMap: Record<string, string> = {};
  const targetsByNetwork = new Map<
    string,
    { key: string; tokenAddress?: string; isNative?: boolean }[]
  >();

  for (const target of targets) {
    if (target.key && target.networkId) {
      const list = targetsByNetwork.get(target.networkId) ?? [];
      list.push({
        key: target.key,
        tokenAddress: target.tokenAddress,
        isNative: target.isNative,
      });
      targetsByNetwork.set(target.networkId, list);
    }
  }

  await Promise.all(
    [...targetsByNetwork.entries()].map(async ([networkId, networkTargets]) => {
      const resolvedTargets = await Promise.all(
        networkTargets.map(async (target) => {
          let tokenAddress = target.tokenAddress;
          if (target.isNative || !tokenAddress) {
            tokenAddress =
              await backgroundApiProxy.serviceToken.getNativeTokenAddress({
                networkId,
              });
          }
          return target.isNative || tokenAddress
            ? { ...target, tokenAddress: tokenAddress ?? '' }
            : undefined;
        }),
      );
      const validTargets = resolvedTargets.filter(
        (
          target,
        ): target is {
          key: string;
          tokenAddress: string;
          isNative?: boolean;
        } => !!target && (target.isNative || !!target.tokenAddress),
      );
      if (!validTargets.length) {
        return;
      }

      const uniqueTokenAddresses = [
        ...new Set(validTargets.map((target) => target.tokenAddress)),
      ];
      const tokenDetails =
        await backgroundApiProxy.serviceToken.fetchTokensDetails({
          accountId,
          networkId,
          contractList: uniqueTokenAddresses,
        });

      const tokenDetailsByAddress = new Map<
        string,
        (typeof tokenDetails)[number]
      >();
      tokenDetails.forEach((tokenDetail) => {
        const address = tokenDetail.info.address;
        if (address) {
          tokenDetailsByAddress.set(address.toLowerCase(), tokenDetail);
        }
      });

      uniqueTokenAddresses.forEach((tokenAddress, index) => {
        const tokenAddressKey = tokenAddress.toLowerCase();
        const tokenDetail =
          tokenDetailsByAddress.get(tokenAddressKey) ?? tokenDetails[index];
        const price = convertPrivateSendTokenDisplayPrice({
          price: tokenDetail?.price,
          sourceCurrency: tokenDetail?.currency ?? USD_CURRENCY_ID,
          targetCurrency,
          currencyMap,
        });
        if (!price) {
          return;
        }
        validTargets
          .filter(
            (target) => target.tokenAddress.toLowerCase() === tokenAddressKey,
          )
          .forEach((target) => {
            priceMap[target.key] = price;
          });
      });
    }),
  );

  return priceMap;
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
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
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
    const nextTxHistoryList = nextRawTxHistoryList;
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
  const displayCurrencyId = settingsPersistAtom.currencyInfo.id;
  const currentCurrencySymbol = settingsPersistAtom.currencyInfo.symbol;
  const displayCurrencySymbol = isPrivateSendHistory
    ? currentCurrencySymbol
    : (txHistory?.currency ?? currentCurrencySymbol);
  const { result: privateSendTokenDisplayPriceMap } =
    usePromiseResult(async () => {
      if (!txHistory || !isPrivateSendHistory) {
        return undefined;
      }
      return fetchPrivateSendTokenDisplayPriceMap({
        item: txHistory,
        targetCurrency: displayCurrencyId,
        currencyMap,
      });
    }, [currencyMap, displayCurrencyId, isPrivateSendHistory, txHistory]);
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
        return (
          <>
            {privateSendDisplayTransfers.map((transfer, index) => {
              const isBaseToken = isBasePrivateSendTransfer({
                transfer,
                txHistory,
              });
              const displayPriceKey = getPrivateSendTransferPriceKey({
                transfer,
                item: txHistory,
              });
              const displayPrice = displayPriceKey
                ? privateSendTokenDisplayPriceMap?.[displayPriceKey]
                : undefined;
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
                price: displayPrice,
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
                  currencySymbol={displayCurrencySymbol}
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
      const baseTokenPriceKey = getPrivateSendBaseTokenPriceKey(txHistory);
      const privateSendFromAsset: ISwapHistoryDetailAssetItem = {
        ...fromAsset,
        price: baseTokenPriceKey
          ? privateSendTokenDisplayPriceMap?.[baseTokenPriceKey]
          : undefined,
      };
      return (
        <AssetItem
          index={0}
          direction={EDecodedTxDirection.OUT}
          asset={privateSendFromAsset}
          isAllNetworks
          amount={fromTokenAmount ?? '0'}
          networkIcon={txHistory?.baseInfo.fromNetwork?.logoURI ?? ''}
          currencySymbol={displayCurrencySymbol}
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
          currencySymbol={displayCurrencySymbol}
        />
        <AssetItem
          index={1}
          direction={EDecodedTxDirection.OUT}
          asset={fromAsset}
          isAllNetworks
          amount={fromTokenAmount ?? '0'}
          networkIcon={txHistory?.baseInfo.fromNetwork?.logoURI ?? ''}
          currencySymbol={displayCurrencySymbol}
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
            currencySymbol={displayCurrencySymbol}
          />
        ))}
      </>
    );
  }, [
    displayCurrencySymbol,
    isPrivateSendHistory,
    privateSendTokenDisplayPriceMap,
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
    if (gasFeeInNativeBN.isNaN() || !gasFeeInNativeBN.isFinite()) {
      return (
        <SizableText size="$bodyMd" color="$textSubdued">
          --
        </SizableText>
      );
    }
    const gasFeeDisplay = gasFeeInNativeBN.toFixed();
    const nativePriceKey = getPrivateSendNetworkNativePriceKey(txHistory);
    let privateSendGasFeeFiatValue: string | undefined;
    if (isPrivateSendHistory && nativePriceKey) {
      const nativeTokenPrice =
        privateSendTokenDisplayPriceMap?.[nativePriceKey];
      if (nativeTokenPrice) {
        privateSendGasFeeFiatValue = gasFeeInNativeBN
          .times(nativeTokenPrice)
          .toFixed();
      }
    }
    const finalGasFeeFiatValue = isPrivateSendHistory
      ? privateSendGasFeeFiatValue
      : gasFeeFiatValue;
    const finalGasFeeFiatValueBN = new BigNumber(finalGasFeeFiatValue ?? '');
    const shouldRenderGasFeeFiatValue =
      !finalGasFeeFiatValueBN.isNaN() && finalGasFeeFiatValueBN.isFinite();
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
            currency: displayCurrencySymbol,
          }}
        >
          {shouldRenderGasFeeFiatValue ? finalGasFeeFiatValue : '--'}
        </NumberSizeableText>
        )
      </SizableText>
    );
  }, [
    displayCurrencySymbol,
    isPrivateSendHistory,
    privateSendTokenDisplayPriceMap,
    txHistory,
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
          currency: displayCurrencySymbol,
        }}
      >
        {protocolFee.toString()}
      </NumberSizeableText>
    );
  }, [
    displayCurrencySymbol,
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
