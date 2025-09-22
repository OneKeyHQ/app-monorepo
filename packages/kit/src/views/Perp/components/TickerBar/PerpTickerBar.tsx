import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  NumberSizeableText,
  ScrollView,
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useCurrentTokenPriceAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import {
  NUMBER_FORMATTER,
  formatDisplayNumber,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { useFundingCountdown, usePerpSession } from '../../hooks';
import { PerpTokenSelector } from '../TokenSelector/PerpTokenSelector';

function PerpTickerBar() {
  const { gtMd } = useMedia();
  const navigation = useAppNavigation();
  const countdown = useFundingCountdown();
  const { isReady, hasError } = usePerpSession();
  const [priceData] = useCurrentTokenPriceAtom();

  const {
    markPrice,
    oraclePrice,
    funding: fundingRate,
    openInterest,
    volume24h,
    change24hPercent,
    coin,
  } = priceData;

  const formattedMarkPrice = markPrice;
  const formattedOraclePrice = oraclePrice;
  const intl = useIntl();
  const showSkeleton = !isReady || hasError || parseFloat(markPrice) === 0;
  const onPressCandleChart = useCallback(() => {
    navigation.push(EModalPerpRoutes.MobilePerpMarket);
  }, [navigation]);

  const onPressTokenSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobileTokenSelector,
    });
  }, [navigation]);

  if (!gtMd) {
    return (
      <XStack
        bg="$bgApp"
        px="$4"
        py="$3"
        alignItems="center"
        justifyContent="flex-start"
      >
        <XStack
          flex={1}
          gap="$4"
          alignItems="center"
          justifyContent="space-between"
        >
          <XStack
            gap="$1"
            bg="$bgApp"
            onPress={onPressTokenSelector}
            justifyContent="center"
            alignItems="center"
          >
            <SizableText size="$headingLg">{coin}-PERP</SizableText>
            <Icon name="MenuOutline" size="$5" />
          </XStack>
          <IconButton
            icon="TradingViewCandlesOutline"
            size="small"
            variant="tertiary"
            onPress={onPressCandleChart}
          />
        </XStack>
      </XStack>
    );
  }

  return (
    <XStack
      bg="$bgApp"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      p="$4"
      alignItems="center"
      justifyContent="flex-start"
      gap="$6"
      h={62}
    >
      <XStack gap="$4" alignItems="center">
        <PerpTokenSelector />
        <XStack alignItems="center" width={140} gap="$1.5" cursor="default">
          {showSkeleton ? (
            <Skeleton width={80} height={28} />
          ) : (
            <Tooltip
              placement="top"
              renderTrigger={
                <SizableText size="$headingXl">
                  {formattedMarkPrice}
                </SizableText>
              }
              renderContent={
                <SizableText size="$bodySm">
                  {intl.formatMessage({
                    id: ETranslations.perp_token_selector_last_price,
                  })}
                </SizableText>
              }
            />
          )}

          {showSkeleton ? (
            <Skeleton width={50} height={16} />
          ) : (
            <NumberSizeableText
              size="$headingXs"
              color={change24hPercent >= 0 ? '$green11' : '$red11'}
              formatter="priceChange"
              formatterOptions={{
                showPlusMinusSigns: true,
              }}
            >
              {change24hPercent}
            </NumberSizeableText>
          )}
        </XStack>
      </XStack>

      {/* Right: Market Data */}
      <ScrollView
        cursor="default"
        horizontal
        flex={1}
        contentContainerStyle={{
          gap: '$8',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <YStack>
          <Tooltip
            renderTrigger={
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_token_bar_oracle_price,
                })}
              </SizableText>
            }
            renderContent={
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_oracle_price_tooltip,
                })}
              </SizableText>
            }
            placement="top"
          />

          {showSkeleton ? (
            <Skeleton width={80} height={16} />
          ) : (
            <SizableText size="$headingXs">{formattedOraclePrice}</SizableText>
          )}
        </YStack>

        <YStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_token_bar_24h_Volume,
            })}
          </SizableText>
          {showSkeleton ? (
            <Skeleton width={80} height={16} />
          ) : (
            <SizableText size="$headingXs">
              $
              {formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(volume24h.toString()),
              )}
            </SizableText>
          )}
        </YStack>

        <YStack>
          <Tooltip
            renderTrigger={
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_token_bar_open_Interest,
                })}
              </SizableText>
            }
            renderContent={
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_open_interest_tooltip,
                })}
              </SizableText>
            }
            placement="top"
          />
          {showSkeleton ? (
            <Skeleton width={80} height={16} />
          ) : (
            <SizableText size="$headingXs">
              $
              {formatDisplayNumber(
                NUMBER_FORMATTER.marketCap(
                  (Number(openInterest) * Number(markPrice)).toString(),
                ),
              )}
            </SizableText>
          )}
        </YStack>

        <YStack>
          <Tooltip
            renderTrigger={
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.perp_token_bar_Funding,
                })}
              </SizableText>
            }
            renderContent={
              <SizableText size="$bodySm">
                {intl.formatMessage({
                  id: ETranslations.perp_funding_tooltip,
                })}
              </SizableText>
            }
            placement="top"
          />
          {showSkeleton ? (
            <Skeleton width={120} height={16} />
          ) : (
            <XStack alignItems="center" gap="$2">
              <SizableText
                size="$headingXs"
                color={parseFloat(fundingRate) >= 0 ? '$green11' : '$red11'}
              >
                {(parseFloat(fundingRate) * 100).toFixed(4)}%
              </SizableText>
              <SizableText size="$headingXs" color="$text">
                {countdown}
              </SizableText>
            </XStack>
          )}
        </YStack>
      </ScrollView>
    </XStack>
  );
}

const PerpTickerBarMemo = memo(PerpTickerBar);
export { PerpTickerBarMemo as PerpTickerBar };
