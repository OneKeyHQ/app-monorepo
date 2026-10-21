import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  getHyperliquidTokenImageUris,
  isSpotInstrument,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { usePerpTradesHistory } from '../../hooks/usePerpOrderInfoPanel';
import { getTradeFillClosePnlBN } from '../OrderInfoPanel/Components/tradeFillDisplay';
import { getFillDirectionDisplayInfo } from '../OrderInfoPanel/utils';

import { simplePerpsCardStyle } from './simpleStyles';

const HISTORY_LIMIT = 6;

export function SimpleTradeHistory({ coin }: { coin?: string }) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const hidePnl = !coin && hideValue;
  const { trades } = usePerpTradesHistory();
  const { result: builderFeeRate } = usePromiseResult(
    () => backgroundApiProxy.simpleDb.perp.getExpectMaxBuilderFee(),
    [],
    { undefinedResultIfError: true },
  );
  const history = useMemo(
    () =>
      trades
        .filter((trade) =>
          coin ? trade.coin === coin : !isSpotInstrument(trade.coin),
        )
        .toSorted((a, b) => b.time - a.time),
    [trades, coin],
  );
  if (!history.length) return null;
  const showMore = () =>
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.PerpTradersHistoryList,
      params: { initialTab: 'Trades', coin },
    });

  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between" gap="$3">
        <SizableText size="$headingLg" flexShrink={1}>
          {coin
            ? intl.formatMessage(
                { id: ETranslations.perp_simple_coin_trade_history__title },
                { coin: parseDexCoin(coin).displayName },
              )
            : intl.formatMessage({
                id: ETranslations.perp_trades_history_title,
              })}
        </SizableText>
      </XStack>
      <YStack
        {...simplePerpsCardStyle}
        borderRadius="$6"
        p={coin ? '$5' : '$4'}
        gap="$3"
      >
        <YStack my="$-2.5" gap={coin ? '$1' : '$0'}>
          {history.slice(0, HISTORY_LIMIT).map((trade) => {
            const { displayName } = parseDexCoin(trade.coin);
            const direction = getFillDirectionDisplayInfo({
              fill: trade,
              intl,
            });
            const directionText = trade.liquidation
              ? `${intl.formatMessage({
                  id:
                    trade.liquidation.method === 'backstop'
                      ? ETranslations.perp_backstop_liquidation__title
                      : ETranslations.perp_market_liquidation__title,
                })}: ${direction.text}`
              : direction.text;
            const pnl = getTradeFillClosePnlBN(trade);
            const visiblePnlColor = pnl.lt(0) ? '$red11' : '$green11';
            const pnlColor = hidePnl ? '$textSubdued' : visiblePnlColor;
            const pnlText = hidePnl
              ? '****'
              : `${pnl.lt(0) ? '-' : ''}${numberFormat(pnl.abs().toFixed(), {
                  formatter: 'value',
                  formatterOptions: { currency: '$' },
                })}`;
            const timeText = formatTime(new Date(trade.time), {
              formatTemplate: 'yyyy-LL-dd HH:mm:ss',
            });
            return (
              <Button
                key={`${trade.coin}-${trade.tid}`}
                variant="tertiary"
                childrenAsText={false}
                minHeight={60}
                height="auto"
                py="$2.5"
                mx="$-2"
                my="$0"
                px="$2"
                borderRadius="$3"
                gap={coin ? '$3' : '$2.5'}
                alignItems="center"
                justifyContent="space-between"
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${displayName}, ${directionText}, ${timeText}, ${intl.formatMessage({ id: ETranslations.perp_trades_close_pnl })} ${pnlText}`}
                testID={`perps-simple-trade-${trade.coin}-${trade.tid}`}
                onPress={() =>
                  navigation.pushModal(EModalRoutes.PerpModal, {
                    screen: EModalPerpRoutes.PerpTradeHistoryDetails,
                    params: {
                      fill: trade,
                      builderFeeRate,
                      sourceSimpleMarketCoin: coin,
                    },
                  })
                }
              >
                {!coin ? (
                  <Token
                    size="lg"
                    borderRadius="$full"
                    tokenImageUris={getHyperliquidTokenImageUris(trade.coin)}
                    fallbackIcon="CryptoCoinOutline"
                  />
                ) : null}
                {coin ? (
                  <>
                    <YStack flex={1} minWidth={0} gap="$1">
                      <SizableText
                        size="$bodyMdMedium"
                        color="$text"
                        numberOfLines={1}
                      >
                        {directionText}
                      </SizableText>
                      <SizableText size="$bodySm" color="$textSubdued">
                        {intl.formatDate(trade.time, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </SizableText>
                    </YStack>
                    <SizableText size="$bodyMdMedium" color={pnlColor}>
                      {pnl.gt(0) ? '+' : ''}
                      {pnlText}
                    </SizableText>
                  </>
                ) : (
                  <YStack flex={1} minWidth={0} gap="$1">
                    <XStack
                      justifyContent="space-between"
                      alignItems="center"
                      gap="$2"
                    >
                      <SizableText
                        size="$bodyMdMedium"
                        color="$text"
                        flexShrink={1}
                        numberOfLines={1}
                      >
                        {displayName}
                      </SizableText>
                      <SizableText size="$bodyMdMedium" color={pnlColor}>
                        {pnlText}
                      </SizableText>
                    </XStack>
                    <XStack
                      justifyContent="space-between"
                      alignItems="center"
                      gap="$2"
                    >
                      <SizableText
                        size="$bodySm"
                        color={direction.color}
                        flexShrink={1}
                        minWidth={0}
                        numberOfLines={1}
                      >
                        {directionText}
                      </SizableText>
                      <SizableText
                        size="$bodySm"
                        color="$textSubdued"
                        flexShrink={0}
                      >
                        {timeText}
                      </SizableText>
                    </XStack>
                  </YStack>
                )}
              </Button>
            );
          })}
        </YStack>
        {coin || history.length > HISTORY_LIMIT ? (
          <Button
            testID={
              coin ? 'perps-simple-history' : 'perps-simple-trade-history-more'
            }
            variant="secondary"
            size="medium"
            borderRadius="$full"
            onPress={showMore}
          >
            {intl.formatMessage({ id: ETranslations.global_view_more })}
          </Button>
        ) : null}
      </YStack>
    </YStack>
  );
}
