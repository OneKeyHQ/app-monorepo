import React, { FC, useCallback, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Image,
  ListItem,
  Pressable,
  Skeleton,
  Typography,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components/src';
import { Token } from '@onekeyhq/engine/src/types/token';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { TabRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import { TabRoutesParams } from '@onekeyhq/kit/src/routes/types';
import { MarketTokenItem } from '@onekeyhq/kit/src/store/reducers/market';

import { useMarketTokenItem } from '../../hooks/useMarketToken';
import { ListHeadTagType } from '../../types';
import {
  formatMarketValueForComma,
  formatMarketValueForFiexd,
  formatMarketValueForInfo,
} from '../../utils';

import { showMarketCellMoreMenu } from './MarketCellMoreMenu';
import SparklineChart from './SparklineChart';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface MarketTokenCellProps {
  onPress?: (marketTokenItem: MarketTokenItem) => void;
  onLongPress?: (marketTokenItem: MarketTokenItem) => void;
  marketTokenId: string;
  headTags: ListHeadTagType[];
}

type NavigationProps = NativeStackNavigationProp<TabRoutesParams>;

const MarketTokenSwapEnable = ({ tokens }: { tokens?: Token[] }) => {
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  if (tokens) {
    return (
      <Button
        borderRadius={12}
        isDisabled={!tokens.length}
        type="basic"
        size="xs"
        onPress={() => {
          backgroundApiProxy.serviceSwap.setOutputToken(tokens[0]);
          navigation.navigate(TabRoutes.Swap);
        }}
      >
        {intl.formatMessage({ id: 'title__swap' })}
      </Button>
    );
  }
  return <Skeleton shape="Caption" />;
};

const MarketTokenCell: FC<MarketTokenCellProps> = ({
  onPress,
  marketTokenId,
  headTags,
  onLongPress,
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const { size } = useUserDevice();
  const isNormalDevice = useMemo(() => ['NORMAL'].includes(size), [size]);
  const marketTokenItem: MarketTokenItem = useMarketTokenItem({
    coingeckoId: marketTokenId,
  });
  const moreButtonRef = useRef();
  const showMore = useCallback(
    () =>
      showMarketCellMoreMenu(
        marketTokenItem,
        {
          header: `${marketTokenItem?.symbol ?? marketTokenItem?.name ?? ''}`,
        },
        moreButtonRef.current,
      ),
    [marketTokenItem],
  );

  return (
    <ListItem
      borderRadius={0}
      onLongPress={() => {
        if (isVerticalLayout && marketTokenItem && onLongPress)
          onLongPress(marketTokenItem);
      }}
      onPress={() => {
        if (marketTokenItem && onPress) {
          onPress(marketTokenItem);
        }
      }}
    >
      {headTags.map((tag) => {
        switch (tag.id) {
          case 1: {
            return (
              <ListItem.Column key={tag.id}>
                <HStack
                  alignItems="center"
                  justifyContent="center"
                  w={tag.minW}
                >
                  {!marketTokenItem ? (
                    <Skeleton shape="Avatar" size={20} />
                  ) : (
                    <Pressable
                      p={1}
                      rounded="full"
                      _hover={{ bgColor: 'surface-hovered' }}
                      _pressed={{ bgColor: 'surface-pressed' }}
                      onPress={() => {
                        if (marketTokenItem.favorited) {
                          backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
                            marketTokenItem.coingeckoId,
                          );
                        } else {
                          backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens(
                            [marketTokenItem.coingeckoId],
                          );
                        }
                      }}
                    >
                      <Icon
                        name="StarSolid"
                        size={20}
                        color={
                          marketTokenItem.favorited
                            ? 'icon-warning'
                            : 'icon-default'
                        }
                      />
                    </Pressable>
                  )}
                </HStack>
              </ListItem.Column>
            );
          }
          case 2: {
            return (
              <ListItem.Column key={tag.id}>
                <HStack alignItems="center" flex={1} space={3}>
                  {marketTokenItem && marketTokenItem.logoURI ? (
                    <Image
                      borderRadius={16}
                      src={marketTokenItem.logoURI}
                      alt={marketTokenItem.logoURI}
                      key={marketTokenItem.logoURI}
                      size={8}
                      fallbackElement={
                        <Icon name="QuestionMarkOutline" size={32} />
                      }
                    />
                  ) : (
                    <Box>
                      <Skeleton shape="Avatar" size={32} />
                    </Box>
                  )}
                  <Box>
                    {marketTokenItem && marketTokenItem.symbol !== undefined ? (
                      <Typography.Body2Strong>
                        {marketTokenItem.symbol}
                      </Typography.Body2Strong>
                    ) : (
                      <Skeleton shape="Body2" />
                    )}
                    {marketTokenItem && marketTokenItem.totalVolume ? (
                      <Typography.Body2 numberOfLines={1} color="text-subdued">
                        {isVerticalLayout || isNormalDevice
                          ? `Vol$${formatMarketValueForInfo(
                              marketTokenItem.totalVolume,
                            )}`
                          : marketTokenItem.name}
                      </Typography.Body2>
                    ) : (
                      <Skeleton shape="Body2" />
                    )}
                  </Box>
                </HStack>
              </ListItem.Column>
            );
          }
          case 3: {
            return marketTokenItem && marketTokenItem.price !== undefined ? (
              <ListItem.Column
                key={tag.id}
                text={{
                  label: `$${
                    marketTokenItem.price < 1
                      ? formatMarketValueForInfo(marketTokenItem.price)
                      : formatMarketValueForComma(marketTokenItem.price)
                  }`,
                  labelProps: { textAlign: tag.textAlign },
                  size: 'sm',
                }}
                flex={1}
              />
            ) : (
              <ListItem.Column key={tag.id}>
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <Skeleton shape="Body2" />
                </Box>
              </ListItem.Column>
            );
          }
          case 4: {
            if (
              marketTokenItem &&
              marketTokenItem.priceChangePercentage24H !== undefined
            ) {
              return isVerticalLayout ? (
                <ListItem.Column key={tag.id}>
                  <Box
                    flex={1}
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
                          ? 'surface-success-subdued'
                          : 'surface-critical-subdued'
                      }
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Typography.Body2Strong
                        textAlign="center"
                        color={
                          marketTokenItem.priceChangePercentage24H >= 0
                            ? 'text-success'
                            : 'text-critical'
                        }
                      >{`${formatMarketValueForFiexd(
                        marketTokenItem.priceChangePercentage24H,
                      )}%`}</Typography.Body2Strong>
                    </Box>
                  </Box>
                </ListItem.Column>
              ) : (
                <ListItem.Column
                  key={tag.id}
                  text={{
                    label: `${formatMarketValueForFiexd(
                      marketTokenItem.priceChangePercentage24H,
                    )}%`,
                    labelProps: {
                      textAlign: tag.textAlign,
                      color:
                        marketTokenItem.priceChangePercentage24H >= 0
                          ? 'text-success'
                          : 'text-critical',
                    },
                    size: 'sm',
                  }}
                  flex={1}
                />
              );
            }
            return (
              <ListItem.Column
                key={tag.id}
                flex={1}
                alignItems="center"
                justifyContent="flex-end"
              >
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <Skeleton shape="Body2" />
                </Box>
              </ListItem.Column>
            );
          }
          case 5: {
            return marketTokenItem &&
              marketTokenItem.totalVolume !== undefined ? (
              <ListItem.Column
                key={tag.id}
                text={{
                  label: `$${formatMarketValueForComma(
                    marketTokenItem.totalVolume,
                  )}`,
                  labelProps: { textAlign: tag.textAlign },
                  size: 'sm',
                }}
                flex={1}
              />
            ) : (
              <ListItem.Column key={tag.id}>
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <Skeleton shape="Body2" />
                </Box>
              </ListItem.Column>
            );
          }
          case 6: {
            return marketTokenItem &&
              marketTokenItem.marketCap !== undefined ? (
              <ListItem.Column
                key={tag.id}
                text={{
                  label: `$${formatMarketValueForComma(
                    marketTokenItem.marketCap,
                  )}`,
                  labelProps: { textAlign: tag.textAlign },
                  size: 'sm',
                }}
                flex={1}
              />
            ) : (
              <ListItem.Column key={tag.id}>
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <Skeleton shape="Body2" />
                </Box>
              </ListItem.Column>
            );
          }
          case 7: {
            return (
              <ListItem.Column key={tag.id}>
                <Box
                  flex={1}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  {marketTokenItem && marketTokenItem.sparkline ? (
                    <SparklineChart
                      data={marketTokenItem.sparkline}
                      width={50}
                      height={40}
                      lineColor={
                        marketTokenItem.priceChangePercentage24H &&
                        marketTokenItem.priceChangePercentage24H >= 0
                          ? '#33C641'
                          : '#FF6259'
                      }
                      linearGradientColor={
                        marketTokenItem.priceChangePercentage24H &&
                        marketTokenItem.priceChangePercentage24H >= 0
                          ? 'rgba(0, 184, 18, 0.2)'
                          : 'rgba(255, 98, 89, 0.2)'
                      }
                    />
                  ) : (
                    <Skeleton shape="Caption" />
                  )}
                </Box>
              </ListItem.Column>
            );
          }
          case 8: {
            return (
              <ListItem.Column key={tag.id}>
                <Box flexDirection="row" flex={1} ref={moreButtonRef}>
                  {marketTokenItem ? (
                    <MarketTokenSwapEnable tokens={marketTokenItem.tokens} />
                  ) : (
                    <Skeleton shape="Caption" />
                  )}
                  <IconButton
                    isDisabled={Boolean(!marketTokenItem)}
                    size="xs"
                    name="DotsVerticalSolid"
                    type="plain"
                    ml="2"
                    circle
                    onPress={showMore}
                  />
                </Box>
              </ListItem.Column>
            );
          }
          default:
            return null;
        }
      })}
    </ListItem>
  );
};

export default React.memo(MarketTokenCell);
