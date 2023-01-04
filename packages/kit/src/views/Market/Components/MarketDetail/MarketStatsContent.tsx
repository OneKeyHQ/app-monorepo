import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Divider, Typography, VStack } from '@onekeyhq/components';
import { SCREEN_SIZE } from '@onekeyhq/components/src/Provider/device';
import { useSettings } from '@onekeyhq/kit/src/hooks';
import type { MarketStats } from '@onekeyhq/kit/src/store/reducers/market';
import { getDefaultLocale } from '@onekeyhq/kit/src/utils/locale';

import { useGridBoxStyle } from '../../hooks/useMarketLayout';
import {
  formatLocalDate,
  formatMarketValueForComma,
  formatMarketVolatility,
  getFiatCodeUnit,
} from '../../utils';

type DataViewComponentProps = {
  title?: string;
  value?: string;
  subValue?: string;
  valueColor?: string;
  index?: number;
};
const DataViewComponent: FC<DataViewComponentProps> = ({
  title,
  value,
  subValue,
  valueColor,
  index,
}) => {
  const gridBoxStyle = useGridBoxStyle({
    index,
    outPadding: 32,
    maxW: SCREEN_SIZE.LARGE,
  });
  return (
    <Box {...gridBoxStyle}>
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        mb="3"
      >
        <Typography.Body2Strong color="text-subdued">
          {title}
        </Typography.Body2Strong>
        <Box alignItems="flex-end">
          <Typography.Body2Strong color={valueColor ?? 'text-default'}>
            {value}
          </Typography.Body2Strong>
          {subValue ? (
            <Typography.Caption color="text-subdued">
              {subValue}
            </Typography.Caption>
          ) : null}
        </Box>
      </Box>
      <Divider />
    </Box>
  );
};

export const MarketStatsContent: FC<MarketStats & { px: string }> = ({
  performance,
  marketCap,
  marketCapDominance,
  marketCapRank,
  trandingVolume,
  low24h,
  high24h,
  atl,
  ath,
  px,
}) => {
  const intl = useIntl();
  const { selectedFiatMoneySymbol } = useSettings();
  const { locale } = useSettings();
  const timeLocal = useMemo(
    () => (locale === 'system' ? locale : getDefaultLocale()),
    [locale],
  );
  return (
    <Box px={px}>
      <VStack space={3} mt="6">
        <Box>
          <Typography.Heading mb="3">
            {intl.formatMessage({ id: 'form__performance' })}
          </Typography.Heading>
          <Box flexDirection="row" alignContent="flex-start" flexWrap="wrap">
            <DataViewComponent
              index={0}
              title={intl.formatMessage({ id: 'form__str_h' }, { 0: 1 })}
              value={`${formatMarketVolatility(
                performance?.priceChangePercentage1h,
              )}%`}
              valueColor={
                performance?.priceChangePercentage1h &&
                performance.priceChangePercentage1h >= 0
                  ? 'text-success'
                  : 'text-critical'
              }
            />
            <DataViewComponent
              index={1}
              title={intl.formatMessage({ id: 'form__str_h' }, { 0: 24 })}
              value={`${formatMarketVolatility(
                performance?.priceChangePercentage24h,
              )}%`}
              valueColor={
                performance?.priceChangePercentage24h &&
                performance.priceChangePercentage24h >= 0
                  ? 'text-success'
                  : 'text-critical'
              }
            />
            <DataViewComponent
              index={2}
              title={intl.formatMessage({ id: 'form__str_d' }, { 0: 7 })}
              value={`${formatMarketVolatility(
                performance?.priceChangePercentage7d,
              )}%`}
              valueColor={
                performance?.priceChangePercentage7d &&
                performance.priceChangePercentage7d >= 0
                  ? 'text-success'
                  : 'text-critical'
              }
            />
            <DataViewComponent
              index={3}
              title={intl.formatMessage({ id: 'form__str_d' }, { 0: 14 })}
              value={`${formatMarketVolatility(
                performance?.priceChangePercentage14d,
              )}%`}
              valueColor={
                performance?.priceChangePercentage14d &&
                performance.priceChangePercentage14d >= 0
                  ? 'text-success'
                  : 'text-critical'
              }
            />
            <DataViewComponent
              index={4}
              title={intl.formatMessage({ id: 'form__str_d' }, { 0: 30 })}
              value={`${formatMarketVolatility(
                performance?.priceChangePercentage30d,
              )}%`}
              valueColor={
                performance?.priceChangePercentage30d &&
                performance.priceChangePercentage30d >= 0
                  ? 'text-success'
                  : 'text-critical'
              }
            />
            <DataViewComponent
              index={5}
              title={intl.formatMessage({ id: 'form__str_y' }, { 0: 1 })}
              value={`${formatMarketVolatility(
                performance?.priceChangePercentage1y,
              )}%`}
              valueColor={
                performance?.priceChangePercentage1y &&
                performance?.priceChangePercentage1y >= 0
                  ? 'text-success'
                  : 'text-critical'
              }
            />
          </Box>
        </Box>
        <Box>
          <Typography.Heading mb="3">
            {intl.formatMessage({ id: 'title__stats' })}
          </Typography.Heading>
          <Box>
            <DataViewComponent
              title={intl.formatMessage({ id: 'form__market_cap' })}
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForComma(marketCap)}`}
            />
            <DataViewComponent
              title={intl.formatMessage({ id: 'form__market_cap_rank' })}
              value={`#${marketCapRank ?? 0}`}
            />
            <DataViewComponent
              title={intl.formatMessage({ id: 'form__market_cap_dominance' })}
              value={`${marketCapDominance ?? 0}`}
            />
            <DataViewComponent
              title={intl.formatMessage({ id: 'form__trading_volume' })}
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForComma(trandingVolume)}`}
            />
            {/* <DataViewComponent
              title={intl.formatMessage({ id: 'form__7d_low' })}
              value={`${low7d ?? 0}`}
            />
            <DataViewComponent
              title={intl.formatMessage({ id: 'form__7d_high' })}
              value={`${high7d ?? 0}`}
            /> */}
            <DataViewComponent
              title={intl.formatMessage({ id: 'form__24h_low' })}
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForComma(low24h)}`}
            />
            <DataViewComponent
              title={intl.formatMessage({ id: 'form__24h_high' })}
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForComma(high24h)}`}
            />
            <DataViewComponent
              title={intl.formatMessage({ id: 'form__all_time_low' })}
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForComma(atl?.value)}`}
              subValue={formatLocalDate(atl?.time, timeLocal)}
            />
            <DataViewComponent
              title={intl.formatMessage({ id: 'form__all_time_high' })}
              value={`${getFiatCodeUnit(
                selectedFiatMoneySymbol,
              )}${formatMarketValueForComma(ath?.value)}`}
              subValue={formatLocalDate(ath?.time, timeLocal)}
            />
          </Box>
        </Box>
      </VStack>
    </Box>
  );
};
