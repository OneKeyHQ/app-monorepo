import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Divider,
  IconButton,
  Image,
  NumberSizeableText,
  Page,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EDecodedTxDirection } from '@onekeyhq/shared/types/tx';

import {
  AssetItem,
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails';
import SwapTxHistoryViewInBrowser from '../../components/SwapHistoryTxViewInBrowser';
import SwapRateInfoItem from '../../components/SwapRateInfoItem';
import { getSwapHistoryStatusTextProps } from '../../utils/utils';
import { withSwapProvider } from '../WithSwapProvider';

import type { RouteProp } from '@react-navigation/core';

const SwapHistoryDetailModal = () => {
  // const navigation =
  //   useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapHistoryDetail>
    >();
  const intl = useIntl();
  const { txHistory } = route.params ?? {};
  // const { swapAgainUseHistoryItem } = useSwapTxHistoryActions();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const { formatDate } = useFormatDate();
  // const onSwapAgain = useCallback(() => {
  //   swapAgainUseHistoryItem(txHistory);
  //   navigation.popStack();
  // }, [navigation, swapAgainUseHistoryItem, txHistory]);

  const { copyText } = useClipboard();
  const onCopy = useCallback(
    async (text: string) => {
      copyText(text, 'msg__success');
    },
    [copyText],
  );
  const onViewInBrowser = useCallback((url: string) => {
    openUrlExternal(url);
  }, []);

  const durationTime = useMemo(() => {
    const { created, updated } = txHistory.date;
    const usedTimeMinusRes = new BigNumber(updated)
      .minus(new BigNumber(created))
      .dividedBy(1000)
      .dividedBy(60)
      .decimalPlaces(0, BigNumber.ROUND_UP)
      .toFixed(0);
    return `${usedTimeMinusRes} min`;
  }, [txHistory.date]);

  const renderSwapAssetsChange = useCallback(() => {
    const fromAsset = {
      name: txHistory.baseInfo.fromToken.name ?? '',
      symbol: txHistory.baseInfo.fromToken.symbol,
      icon: txHistory.baseInfo.fromToken.logoURI ?? '',
      isNFT: false,
      isNative: !!txHistory.baseInfo.fromToken.isNative,
      price: txHistory.baseInfo.fromToken.price.toString(),
    };

    const toAsset = {
      name: txHistory.baseInfo.toToken.name ?? '',
      symbol: txHistory.baseInfo.toToken.symbol,
      icon: txHistory.baseInfo.toToken.logoURI ?? '',
      isNFT: false,
      isNative: !!txHistory.baseInfo.toToken.isNative,
      price: txHistory.baseInfo.toToken.price.toString(),
    };

    return (
      <>
        <AssetItem
          index={0}
          direction={EDecodedTxDirection.IN}
          asset={toAsset}
          amount={txHistory.baseInfo.toAmount}
          networkIcon={txHistory.baseInfo.toNetwork?.logoURI ?? ''}
          currencySymbol={settingsPersistAtom.currencyInfo.symbol}
        />
        <AssetItem
          index={1}
          direction={EDecodedTxDirection.OUT}
          asset={fromAsset}
          amount={txHistory.baseInfo.fromAmount}
          networkIcon={txHistory.baseInfo.fromNetwork?.logoURI ?? ''}
          currencySymbol={settingsPersistAtom.currencyInfo.symbol}
        />
      </>
    );
  }, [settingsPersistAtom.currencyInfo.symbol, txHistory]);

  const renderSwapOrderStatus = useCallback(() => {
    const { status } = txHistory;
    const { key, color } = getSwapHistoryStatusTextProps(status);
    return (
      <SizableText size={16} color={color}>
        {intl.formatMessage({ id: key })}
      </SizableText>
    );
  }, [intl, txHistory]);

  const renderSwapDate = useCallback(() => {
    const { created } = txHistory.date;
    const dateObj = new Date(created);
    const dateStr = formatDate(dateObj);
    return (
      <SizableText size={14} color="$textSubdued">
        {dateStr}
      </SizableText>
    );
  }, [formatDate, txHistory.date]);

  const renderCanCopyText = useCallback(
    (text: string) => (
      <XStack flex={1}>
        <SizableText
          w="95%"
          wordWrap="break-word"
          size={14}
          color="$textSubdued"
        >
          {text}
        </SizableText>
        <IconButton
          w="$6"
          h="$6"
          size="small"
          icon="Copy1Outline"
          onPress={() => onCopy(text)}
        />
      </XStack>
    ),
    [onCopy],
  );

  const renderNetworkFee = useCallback(() => {
    const { gasFeeFiatValue, gasFeeInNative } = txHistory.txInfo;
    const gasFeeInNativeBN = new BigNumber(gasFeeInNative ?? 0);
    const gasFeeDisplay = gasFeeInNativeBN.toFixed();
    return (
      <SizableText size={14} color="$textSubdued">
        <NumberSizeableText color="$textSubdued" formatter="balance">
          {gasFeeDisplay}
        </NumberSizeableText>
        {txHistory.baseInfo.fromNetwork?.symbol ?? ''}(
        <NumberSizeableText
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settingsPersistAtom.currencyInfo.symbol,
          }}
        >
          {gasFeeFiatValue ?? 0}
        </NumberSizeableText>
        )
      </SizableText>
    );
  }, [
    settingsPersistAtom.currencyInfo.symbol,
    txHistory.baseInfo.fromNetwork?.symbol,
    txHistory.txInfo,
  ]);

  const renderRate = useCallback(
    () => (
      <SwapRateInfoItem
        rate={txHistory.swapInfo.instantRate}
        fromToken={txHistory.baseInfo.fromToken}
        toToken={txHistory.baseInfo.toToken}
        providerUrl={txHistory.swapInfo.provider.providerLogo ?? ''}
      />
    ),
    [
      txHistory.baseInfo.fromToken,
      txHistory.baseInfo.toToken,
      txHistory.swapInfo.instantRate,
      txHistory.swapInfo.provider.providerLogo,
    ],
  );
  const renderSwapHistoryDetails = useCallback(() => {
    if (!txHistory) {
      return null;
    }

    return (
      <>
        <Stack>{renderSwapAssetsChange()}</Stack>
        <Stack>
          <InfoItemGroup>
            <InfoItem
              label="Order status"
              renderContent={renderSwapOrderStatus()}
              compact
            />
            <InfoItem label="Date" renderContent={renderSwapDate()} compact />
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            <InfoItem
              label="From"
              renderContent={renderCanCopyText(txHistory.txInfo.sender)}
            />
            <InfoItem
              label="To"
              renderContent={renderCanCopyText(txHistory.txInfo.receiver)}
            />
            <InfoItem
              label="Transaction hash"
              renderContent={renderCanCopyText(txHistory.txInfo.txId)}
            />
            <InfoItem label="Network Fee" renderContent={renderNetworkFee()} />
          </InfoItemGroup>
          <Divider mx="$5" />
          <InfoItemGroup>
            {txHistory.txInfo.orderId ? (
              <InfoItem
                label="Order ID"
                renderContent={renderCanCopyText(txHistory.txInfo.orderId)}
              />
            ) : null}
            <InfoItem label="Rate" renderContent={renderRate()} />
            <InfoItem label="Swap duration" renderContent={durationTime} />
            {txHistory.swapInfo.oneKeyFee ? (
              <InfoItem
                label="Service Fee"
                renderContent={`${txHistory.swapInfo.oneKeyFee} %`}
              />
            ) : null}
          </InfoItemGroup>
          <XStack justifyContent="space-between" py="$4" mx="$5">
            <Image
              resizeMode="contain"
              w={100}
              h={28}
              source={require('../../../../../assets/swap_history_logo.png')}
            />
            <SwapTxHistoryViewInBrowser
              item={txHistory}
              onViewInBrowser={onViewInBrowser}
            />
          </XStack>
        </Stack>
      </>
    );
  }, [
    durationTime,
    onViewInBrowser,
    renderCanCopyText,
    renderNetworkFee,
    renderRate,
    renderSwapAssetsChange,
    renderSwapDate,
    renderSwapOrderStatus,
    txHistory,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header headerTitle="Transaction" />
      <Page.Body>{renderSwapHistoryDetails()}</Page.Body>
    </Page>
  );
};

export default withSwapProvider(SwapHistoryDetailModal);
