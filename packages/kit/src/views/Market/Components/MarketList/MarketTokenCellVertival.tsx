import type { FC } from 'react';
import { memo, useMemo } from 'react';

import {
  Box,
  Pressable,
  Skeleton,
  Token,
  Typography,
} from '@onekeyhq/components';

import { useSettings } from '../../../../hooks';
import { useCurrencyUnit } from '../../../Me/GenaralSection/CurrencySelect/hooks';
import { useMarketTokenItem } from '../../hooks/useMarketToken';
import {
  formatDecimalZero,
  formatMarketUnitPosition,
  formatMarketValueForComma,
  formatMarketValueForInfo,
  formatMarketVolatility,
} from '../../utils';

import type { MarketTokenItem } from '../../../../store/reducers/market';

interface IMarketTokenCellVertivalProps {
  onPress?: (marketTokenItem: MarketTokenItem) => void;
  onLongPress?: (marketTokenItem: MarketTokenItem) => void;
  marketTokenId: string;
}
const MarketTokenCellVertival: FC<IMarketTokenCellVertivalProps> = ({
  onPress,
  marketTokenId,
  onLongPress,
}) => {
  const { selectedFiatMoneySymbol } = useSettings();
  const unit = useCurrencyUnit(selectedFiatMoneySymbol);
  const marketTokenItem: MarketTokenItem | undefined = useMarketTokenItem({
    coingeckoId: marketTokenId,
    isList: true,
  });
  const marketCap = useMemo(() => {
    if (!marketTokenItem?.marketCap) {
      return '';
    }
    return formatMarketUnitPosition(
      unit,
      formatMarketValueForInfo(marketTokenItem?.marketCap),
    );
  }, [marketTokenItem?.marketCap, unit]);
  const tokenPrice = useMemo(() => {
    if (!marketTokenItem?.price) {
      return '';
    }
    return formatMarketUnitPosition(
      unit,
      marketTokenItem.price <= 1
        ? formatDecimalZero(marketTokenItem.price)
        : formatMarketValueForComma(marketTokenItem.price),
    );
  }, [marketTokenItem?.price, unit]);
  const percentage = useMemo(() => {
    if (!marketTokenItem?.priceChangePercentage24H) {
      return '';
    }
    return `${formatMarketVolatility(
      marketTokenItem.priceChangePercentage24H,
    )}%`;
  }, [marketTokenItem?.priceChangePercentage24H]);
  return (
    <Pressable
      onLongPress={() => {
        if (marketTokenItem && onLongPress) onLongPress(marketTokenItem);
      }}
      onPress={() => {
        if (marketTokenItem && onPress) {
          onPress(marketTokenItem);
        }
      }}
    >
      {({ isPressed }) => (
        <Box
          px={2}
          py={1.5}
          my={0.5}
          alignItems="center"
          flexDirection="row"
          borderRadius="xl"
          bgColor={isPressed ? 'surface-pressed' : undefined}
        >
          <Box alignItems="center" flexDirection="row" flex={1}>
            {marketTokenItem && marketTokenItem.logoURI !== undefined ? (
              <Token
                size={8}
                mr={3}
                token={{
                  logoURI: marketTokenItem.logoURI,
                  name: marketTokenItem.name,
                  symbol: marketTokenItem.symbol,
                }}
              />
            ) : (
              <Box mr={3}>
                <Skeleton shape="Avatar" size={32} />
              </Box>
            )}
            <Box>
              {marketTokenItem && marketTokenItem.symbol !== undefined ? (
                <Typography.Body1Strong>
                  {marketTokenItem.symbol}
                </Typography.Body1Strong>
              ) : (
                <Skeleton shape="Body2" />
              )}
              {marketTokenItem && marketTokenItem.marketCap !== undefined ? (
                <Typography.Body2 numberOfLines={1} color="text-subdued">
                  {marketCap}
                </Typography.Body2>
              ) : (
                <Skeleton shape="Body2" />
              )}
            </Box>
          </Box>
          <Box>
            {marketTokenItem && marketTokenItem.price !== undefined ? (
              <Typography.Body2Strong>{tokenPrice}</Typography.Body2Strong>
            ) : (
              <Box
                flex={1}
                flexDirection="row"
                alignItems="center"
                justifyContent="flex-end"
              >
                <Skeleton shape="Body2" />
              </Box>
            )}
          </Box>
          <Box>
            {marketTokenItem && marketTokenItem.priceChangePercentage24H ? (
              <Box
                // flex={1}
                w="100px"
                flexDirection="row"
                alignItems="center"
                justifyContent="flex-end"
              >
                <Box
                  width="72px"
                  height="32px"
                  borderRadius="6px"
                  backgroundColor={
                    marketTokenItem.priceChangePercentage24H >= 0
                      ? 'focused-default'
                      : 'focused-critical'
                  }
                  alignItems="center"
                  justifyContent="center"
                >
                  <Typography.Body2Strong
                    textAlign="center"
                    color="text-on-primary"
                  >
                    {percentage}
                  </Typography.Body2Strong>
                </Box>
              </Box>
            ) : (
              <Box
                // flex={1}
                w="90px"
                flexDirection="row"
                alignItems="center"
                justifyContent="flex-end"
              >
                <Skeleton shape="Body2" />
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Pressable>
  );
};

export default memo(MarketTokenCellVertival);
