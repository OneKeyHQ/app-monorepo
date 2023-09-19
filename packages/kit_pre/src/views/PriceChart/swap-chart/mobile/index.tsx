import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Token as TokenImage,
  Typography,
  VStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import type {
  Token,
  Token as TokenType,
} from '@onekeyhq/engine/src/types/token';

import { FormatCurrencyNumber } from '../../../../components/Format';
import { useReduxSingleTokenPriceSimple } from '../../../../hooks';
import useFormatDate from '../../../../hooks/useFormatDate';
import { showOverlay } from '../../../../utils/overlayUtils';
import { calculateGains } from '../../../../utils/priceUtils';
import { formatDecimalZero } from '../../../Market/utils';
import { BottomSheetSettings } from '../../../Overlay/BottomSheetSettings';
import { type OnHoverFunction, fetchChartData } from '../../chartService';
import TimeControl from '../../TimeControl';
import ChartLabel from '../ChartLabel';
import ChartLayout from '../ChartLayout';
import { useChartState } from '../hooks/useChartState';
import PriceDisplayInfo from '../PriceDisplayInfo';
import { type SwapChartProps } from '../types';

import type { MarketApiData } from '../../chartService';

type SwapChartHeaderProps = {
  currentPrice: number | null;
  time: string;
  basePrice: number;
  inputToken: TokenType;
  outputToken: TokenType;
};

const SwapChartHeader: FC<SwapChartHeaderProps> = ({
  currentPrice,
  basePrice,
  time,
  inputToken,
  outputToken,
}) => (
  <Box>
    <Box mb="4">
      <ChartLabel inputToken={inputToken} outputToken={outputToken} />
    </Box>
    <Box flexDirection="row" justifyContent="space-between">
      <Typography.DisplayXLarge my="1">
        {currentPrice ? formatDecimalZero(currentPrice) : ''}
      </Typography.DisplayXLarge>
    </Box>
    <Box>
      <PriceDisplayInfo
        price={currentPrice}
        time={time}
        basePrice={basePrice}
      />
    </Box>
  </Box>
);

type SwapChartFooterTokenInfoItemProps = {
  token: Token;
  data: MarketApiData[];
};

const SwapChartFooterTokenInfoItem: FC<SwapChartFooterTokenInfoItemProps> = ({
  token,
  data,
}) => {
  const basePrice = data?.length ? data[0][1] : 0;
  const latestPrice = data?.length ? data[data.length - 1][1] : 0;

  const priceInfo = useReduxSingleTokenPriceSimple({ token });

  const { gainTextBg, percentageGain, gainTextColor } = useMemo(
    () =>
      calculateGains({
        basePrice,
        price: latestPrice,
      }),
    [basePrice, latestPrice],
  );
  return (
    <Box flexDirection="row" justifyContent="space-between" w="full">
      <Box flexDirection="row">
        <TokenImage token={token} />
        <Box ml="3">
          <Typography.Body1Strong>{token.symbol}</Typography.Body1Strong>
          <Typography.Body2 color="text-subdued">{token.name}</Typography.Body2>
        </Box>
      </Box>
      <Box flexDirection="column" alignItems="flex-end">
        <Typography.Body1>
          <FormatCurrencyNumber value={0} convertValue={priceInfo.price} />
        </Typography.Body1>
        <Box flexDirection="row">
          <Box
            mt="4px"
            bg={gainTextBg}
            px="6px"
            py="2px"
            borderRadius="6px"
            justifyContent="center"
            alignItems="center"
          >
            <Typography.CaptionStrong color={gainTextColor}>
              {percentageGain}
            </Typography.CaptionStrong>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

type SwapChartFooterProps = {
  enabled: boolean;
  selectedIndex: number;
  onTimeChange: (time: string) => void;
  fromToken: Token;
  toToken: Token;
  fromData: MarketApiData[];
  toData: MarketApiData[];
};

const SwapChartFooter: FC<SwapChartFooterProps> = ({
  enabled,
  selectedIndex,
  onTimeChange,
  fromToken,
  toToken,
  fromData,
  toData,
}) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  return (
    <Box pb={`${bottom}px`}>
      <Box w="full">
        <TimeControl
          enabled={enabled}
          selectedIndex={selectedIndex}
          onTimeChange={onTimeChange}
        />
      </Box>
      <Box>
        <Typography.Heading my="4">
          {intl.formatMessage({ id: 'title__token_info' })}
        </Typography.Heading>
        <VStack space="2" w="full">
          <SwapChartFooterTokenInfoItem token={fromToken} data={fromData} />
          <SwapChartFooterTokenInfoItem token={toToken} data={toData} />
        </VStack>
      </Box>
    </Box>
  );
};

const SwapChartBottomSheet: FC<SwapChartProps> = ({ fromToken, toToken }) => {
  const { data, refreshDataOnTimeChange, isFetching, selectedTimeIndex } =
    useChartState({ fromToken, toToken });
  const { formatDate } = useFormatDate();
  const [price, setPrice] = useState<string | number | undefined>();
  const [time, setTime] = useState(formatDate(new Date()));
  const { finalData, fromData, toData } = data;
  const basePrice = finalData?.length ? finalData[0][1] : 0;
  const latestPrice = finalData?.length
    ? finalData[finalData.length - 1][1]
    : 0;
  let currentPrice;
  if (!data) {
    currentPrice = null;
  } else if (price === 'undefined' || price === undefined) {
    currentPrice = latestPrice;
  } else if (typeof price === 'string') {
    currentPrice = +price;
  } else {
    currentPrice = price;
  }

  const onHover = useCallback<OnHoverFunction>(
    (hoverData) => {
      let displayTime;
      if (hoverData.time instanceof Date) {
        displayTime = formatDate(hoverData.time);
      } else if (typeof hoverData.time === 'number') {
        displayTime = formatDate(new Date(hoverData.time));
      } else if (typeof hoverData.time === 'string') {
        displayTime = formatDate(new Date(+hoverData.time));
      } else {
        displayTime = formatDate(new Date());
      }
      setTime(displayTime);
      setPrice(hoverData.price);
    },
    [formatDate],
  );
  return (
    <ChartLayout
      header={
        <SwapChartHeader
          currentPrice={currentPrice}
          basePrice={basePrice}
          time={time}
          inputToken={fromToken}
          outputToken={toToken}
        />
      }
      footer={
        <SwapChartFooter
          selectedIndex={selectedTimeIndex}
          onTimeChange={refreshDataOnTimeChange}
          enabled={!isFetching && !!data}
          fromToken={fromToken}
          toToken={toToken}
          fromData={fromData}
          toData={toData}
        />
      }
      data={finalData}
      onHover={onHover}
      isFetching={isFetching}
      height={200}
      mt={10}
    />
  );
};

const fetchTokenChartData = (token: TokenType) =>
  fetchChartData({
    networkId: token.networkId,
    contract: token.tokenIdOnNetwork,
    days: '1',
    points: '100',
    vs_currency: 'usd',
  });

const SwapChartSwapChartBottomSheetTrigger: FC<SwapChartProps> = ({
  fromToken,
  toToken,
}) => {
  const [priceInfo, setPriceInfo] = useState<
    | { percentageGain: string; gainTextColor: string; latestPrice: number }
    | undefined
  >();
  const onPress = useCallback(() => {
    showOverlay((closeOverlay) => (
      <BottomSheetSettings closeOverlay={closeOverlay}>
        <SwapChartBottomSheet fromToken={fromToken} toToken={toToken} />
      </BottomSheetSettings>
    ));
  }, [fromToken, toToken]);

  useEffect(() => {
    async function main() {
      const a = fetchTokenChartData(fromToken);
      const b = fetchTokenChartData(toToken);
      const results = await Promise.all([a, b]);
      const [fromData, toData] = results;
      const len = Math.min(fromData.length, toData.length);
      const data = fromData.slice(0, len - 1).map((item, i) => {
        const timestamp = item[0];
        const fromValue = item[1];
        const toValue = toData[i][1];
        const value = fromValue / toValue;
        return [timestamp, value];
      });
      const basePrice = data?.length ? data[0][1] : 0;
      const latestPrice = data?.length ? data[data.length - 1][1] : 0;
      const { percentageGain, gainTextColor } = calculateGains({
        basePrice,
        price: latestPrice,
      });
      setPriceInfo({ percentageGain, gainTextColor, latestPrice });
    }
    main();
  }, [fromToken, toToken]);

  return (
    <Pressable onPress={onPress}>
      <Box
        py="2"
        px="3"
        borderTopRadius={12}
        borderTopWidth={0.5}
        borderLeftWidth={0.5}
        borderRightWidth={0.5}
        borderBottomWidth={0}
        borderColor="divider"
        flexDirection="row"
        justifyContent="space-between"
      >
        <Typography.Body2Strong>
          {fromToken.symbol.toUpperCase()}/{toToken.symbol.toUpperCase()}
        </Typography.Body2Strong>
        {!priceInfo ? (
          <Typography.Body2Strong color="text-subdued" ml="8px">
            +0.00(+0.00%)
          </Typography.Body2Strong>
        ) : (
          <Box flexDirection="row" alignItems="center">
            <Typography.Body2Strong>
              {priceInfo.latestPrice
                ? formatDecimalZero(priceInfo.latestPrice)
                : ''}
            </Typography.Body2Strong>
            <Typography.Body2Strong color={priceInfo.gainTextColor}>
              ({priceInfo.percentageGain})
            </Typography.Body2Strong>
            <Icon name="ChevronUpMini" size={20} />
          </Box>
        )}
      </Box>
    </Pressable>
  );
};

export default SwapChartSwapChartBottomSheetTrigger;
