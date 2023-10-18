import type { FC } from 'react';
import { memo, useCallback, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  ListItem,
  Pressable,
  Skeleton,
  Text,
  ToastManager,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettings } from '@onekeyhq/kit/src/hooks';
import { TabRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import type { TabRoutesParams } from '@onekeyhq/kit/src/routes/types';
import type { MarketTokenItem } from '@onekeyhq/kit/src/store/reducers/market';
import { MARKET_FAVORITES_CATEGORYID } from '@onekeyhq/kit/src/store/reducers/market';

import { useCurrencyUnit } from '../../../Me/GenaralSection/CurrencySelect/hooks';
import { coingeckoId2StakingTypes } from '../../../Staking/utils';
import { MarketStakeButton } from '../../../Staking/Widgets/MarketStakingButton';
import { EMarketCellData, MARKET_LIST_COLUMN_SHOW_WIDTH_1 } from '../../config';
import { useMarketSelectedCategoryId } from '../../hooks/useMarketCategory';
import { useMarketWidthLayout } from '../../hooks/useMarketLayout';
import { useMarketTokenItem } from '../../hooks/useMarketToken';
import {
  formatDecimalZero,
  formatMarketUnitPosition,
  formatMarketValueForComma,
  formatMarketValueForInfo,
  formatMarketVolatility,
} from '../../utils';

import { showMarketCellMoreMenu } from './MarketCellMoreMenu';
import SparklineChart from './SparklineChart';

import type { ListHeadTagType } from '../../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface MarketTokenCellProps {
  onPress?: (marketTokenItem: MarketTokenItem) => void;
  onLongPress?: (marketTokenItem: MarketTokenItem) => void;
  marketTokenId: string;
  headTags: ListHeadTagType[];
}

type NavigationProps = NativeStackNavigationProp<TabRoutesParams>;

const MarketTokenSwapEnable = ({ tokens }: { tokens?: TokenType[] }) => {
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
          backgroundApiProxy.serviceSwap.buyToken(tokens[0]);
          navigation.navigate(TabRoutes.Swap);
        }}
      >
        {intl.formatMessage({ id: 'title__swap' })}
      </Button>
    );
  }
  return <Skeleton shape="Caption" />;
};

const MarketCollectStartButton = ({
  marketTokenItem,
}: {
  marketTokenItem: MarketTokenItem;
}) => {
  const intl = useIntl();
  return (
    <Pressable
      flexDirection="row"
      alignItems="center"
      p="1"
      rounded="full"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
      onPress={() => {
        if (marketTokenItem.favorited) {
          backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
            marketTokenItem.coingeckoId,
          );
          ToastManager.show({
            title: intl.formatMessage({
              id: 'msg__removed',
            }),
          });
        } else {
          backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens([
            {
              coingeckoId: marketTokenItem.coingeckoId,
              symbol: marketTokenItem.symbol,
            },
          ]);
          ToastManager.show({
            title: intl.formatMessage({
              id: 'msg__added_to_favorites',
            }),
          });
        }
      }}
    >
      <Icon
        name={marketTokenItem.favorited ? 'StarSolid' : 'StarOutline'}
        size={20}
        color={marketTokenItem.favorited ? 'icon-warning' : 'icon-subdued'}
      />
    </Pressable>
  );
};

const MarketTokenCell: FC<MarketTokenCellProps> = ({
  onPress,
  marketTokenId,
  headTags,
  onLongPress,
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const { selectedFiatMoneySymbol } = useSettings();
  const unit = useCurrencyUnit(selectedFiatMoneySymbol);
  const { marketFillWidth } = useMarketWidthLayout();
  const selectedCategoryId = useMarketSelectedCategoryId();
  const stakingType = coingeckoId2StakingTypes[marketTokenId];
  const marketTokenItem: MarketTokenItem | undefined = useMarketTokenItem({
    coingeckoId: marketTokenId,
    isList: true,
  });
  const moreButtonRef = useRef();
  const showMore = useCallback(
    () =>
      marketTokenItem &&
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
          case EMarketCellData.CollectionStarOrSerialNumber: {
            return (
              <ListItem.Column key={tag.id}>
                <HStack
                  alignItems="center"
                  justifyContent={
                    tag.isSearch ? 'center' : tag?.textAlign ?? 'center'
                  }
                  w={!tag.isSearch ? tag.minW : undefined}
                >
                  {!marketTokenItem ? (
                    <Skeleton shape="Avatar" size={20} />
                  ) : (
                    <>
                      {tag.isSearch ? (
                        <MarketCollectStartButton
                          marketTokenItem={marketTokenItem}
                        />
                      ) : (
                        <Typography.Body2Strong
                          ml={0.5}
                          textAlign={tag?.textAlign ?? 'center'}
                        >
                          {marketTokenItem.serialNumber ?? '-'}
                        </Typography.Body2Strong>
                      )}
                    </>
                  )}
                </HStack>
              </ListItem.Column>
            );
          }
          case EMarketCellData.TokenInfo: {
            return (
              <ListItem.Column key={tag.id}>
                <HStack alignItems="center" w={tag?.minW ?? '100px'} space={3}>
                  {marketTokenItem && marketTokenItem.logoURI !== undefined ? (
                    <Token
                      size={8}
                      token={{
                        logoURI: marketTokenItem.logoURI,
                        name: marketTokenItem.name,
                        symbol: marketTokenItem.symbol,
                      }}
                    />
                  ) : (
                    <Box>
                      <Skeleton shape="Avatar" size={32} />
                    </Box>
                  )}
                  <Box>
                    {marketTokenItem && marketTokenItem.symbol !== undefined ? (
                      <Text
                        typography={
                          tag.isSearch ? 'Body2Strong' : 'Body1Strong'
                        }
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        w="80px"
                      >
                        {marketTokenItem.symbol}
                      </Text>
                    ) : (
                      <Skeleton shape="Body2" />
                    )}
                    {marketTokenItem &&
                    marketTokenItem.marketCap !== undefined ? (
                      <Typography.Body2
                        numberOfLines={1}
                        color="text-subdued"
                        ellipsizeMode="tail"
                        w="80px"
                      >
                        {isVerticalLayout ||
                        marketFillWidth <= MARKET_LIST_COLUMN_SHOW_WIDTH_1
                          ? formatMarketUnitPosition(
                              unit,
                              formatMarketValueForInfo(
                                marketTokenItem.marketCap,
                              ),
                            )
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
          case EMarketCellData.TokenPrice: {
            return marketTokenItem && marketTokenItem.price !== undefined ? (
              <ListItem.Column
                key={tag.id}
                text={{
                  label: formatMarketUnitPosition(
                    unit,
                    marketTokenItem.price <= 1
                      ? formatDecimalZero(marketTokenItem.price)
                      : formatMarketValueForComma(marketTokenItem.price),
                  ),
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
          case EMarketCellData.Token24hChange: {
            if (
              marketTokenItem &&
              marketTokenItem.priceChangePercentage24H !== undefined
            ) {
              return isVerticalLayout ? (
                <ListItem.Column key={tag.id}>
                  <Box
                    // flex={1}
                    w={tag.minW}
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
                      >{`${formatMarketVolatility(
                        marketTokenItem.priceChangePercentage24H,
                      )}%`}</Typography.Body2Strong>
                    </Box>
                  </Box>
                </ListItem.Column>
              ) : (
                <ListItem.Column
                  key={tag.id}
                  text={{
                    label: `${formatMarketVolatility(
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
                  // flex={1}
                  w={tag.minW}
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
          /* case EMarketCellData.Token24hVolume: {
            return marketTokenItem &&
              marketTokenItem.totalVolume !== undefined ? (
              <ListItem.Column
                key={tag.id}
                text={{
                  label: formatMarketUnitPosition(
                    unit,
                    formatMarketValueForComma(marketTokenItem.totalVolume),
                  ),
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
          } */
          // 隐藏24hVolume
          case EMarketCellData.TokenMarketCap: {
            return marketTokenItem &&
              marketTokenItem.marketCap !== undefined ? (
              <ListItem.Column
                key={tag.id}
                text={{
                  label: formatMarketUnitPosition(
                    unit,
                    formatMarketValueForComma(marketTokenItem.marketCap),
                  ),
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
          case EMarketCellData.TokenSparklineChart: {
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
                      width={100}
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
                    <Skeleton shape="DisplayMedium" />
                  )}
                </Box>
              </ListItem.Column>
            );
          }
          case EMarketCellData.TokenSwapStatus: {
            return (
              <ListItem.Column key={tag.id}>
                <Box
                  flexDirection="row"
                  justifyContent="left"
                  flex={1}
                  ref={moreButtonRef}
                >
                  {marketTokenItem ? (
                    <>
                      <MarketTokenSwapEnable tokens={marketTokenItem.tokens} />
                      {stakingType && (
                        <Box ml="2">
                          <MarketStakeButton
                            stakingType={stakingType}
                            buttonType="text"
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    <Skeleton shape="DisplaySmall" />
                  )}
                </Box>
              </ListItem.Column>
            );
          }
          case EMarketCellData.TokenCollectionStarAndMore: {
            return (
              <ListItem.Column key={tag.id}>
                <Box
                  flexDirection="row"
                  justifyContent="center"
                  flex={1}
                  ref={moreButtonRef}
                >
                  {marketTokenItem ? (
                    <MarketCollectStartButton
                      marketTokenItem={marketTokenItem}
                    />
                  ) : (
                    <Skeleton shape="Caption" />
                  )}
                  {selectedCategoryId === MARKET_FAVORITES_CATEGORYID ? (
                    <IconButton
                      isDisabled={Boolean(!marketTokenItem)}
                      size="xs"
                      name="EllipsisVerticalMini"
                      type="plain"
                      ml="2"
                      circle
                      onPress={showMore}
                    />
                  ) : null}
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

export default memo(MarketTokenCell);
