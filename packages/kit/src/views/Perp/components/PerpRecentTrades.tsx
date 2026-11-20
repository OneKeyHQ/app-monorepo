import { memo, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Anchor,
  Button,
  Icon,
  ScrollView,
  SizableText,
  Spinner,
  XStack,
  YStack,
  getCurrentVisibilityState,
  useTheme,
  useVisibilityChange,
} from '@onekeyhq/components';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { HYPER_LIQUID_ORIGIN } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import { formatLocalizedNumberString } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpPublicTrades } from '../hooks/usePerpPublicTrades';
import { ORDER_BOOK_VERTICAL_ROW_STEP } from '../layouts/perpLayoutUtils';

import { PerpBookText, orderBookTextStyles } from './OrderBook';
import { ORDER_BOOK_HORIZONTAL_ROW_HEIGHT } from './OrderBook/AnimatedDepthBlock.shared';

function TradeLine({
  price,
  size,
  time,
  hash,
  side,
  priceLabel,
  inline,
}: {
  price: string;
  size: string;
  time: string;
  hash?: IRecentTrade['hash'];
  side?: IRecentTrade['side'];
  priceLabel?: string;
  inline: boolean;
}) {
  const theme = useTheme();
  const intl = useIntl();
  const isHeader = side === undefined;
  const headerStyle = inline
    ? orderBookTextStyles.horizontalHeader
    : orderBookTextStyles.verticalHeader;
  const dataStyle = inline
    ? orderBookTextStyles.horizontalTabular
    : orderBookTextStyles.tabular;
  const textStyle = isHeader ? headerStyle : dataStyle;
  const textColor = isHeader ? theme.textSubdued.val : theme.text.val;
  const priceColors = { A: theme.bgCriticalStrong.val, B: theme.bgAccent.val };
  const priceCell = (
    <PerpBookText
      numberOfLines={1}
      style={[
        textStyle,
        {
          width: inline ? '34%' : '33%',
          color: side ? priceColors[side] : textColor,
        },
      ]}
      aria-label={priceLabel}
    >
      {price}
    </PerpBookText>
  );
  const sizeCell = (
    <PerpBookText
      numberOfLines={1}
      style={[
        textStyle,
        { width: inline ? '36%' : '30%', textAlign: 'right', color: textColor },
      ]}
    >
      {size}
    </PerpBookText>
  );
  const timeWidth = inline ? '30%' : '37%';
  const transactionUrl =
    hash && /^0x[0-9a-f]{64}$/i.test(hash)
      ? `${HYPER_LIQUID_ORIGIN}/explorer/tx/${hash}`
      : undefined;
  const timeCell = transactionUrl ? (
    <XStack
      w={timeWidth}
      alignSelf="stretch"
      alignItems="center"
      justifyContent={inline ? 'flex-start' : 'flex-end'}
      gap="$0.5"
    >
      <PerpBookText
        numberOfLines={1}
        style={[textStyle, { flexShrink: 1, color: textColor }]}
      >
        {time}
      </PerpBookText>
      <Anchor
        asChild="except-style"
        href={transactionUrl}
        rel="noopener noreferrer"
        showExternalIndicator={false}
        aria-label={`${time} · ${intl.formatMessage({ id: ETranslations.settings_view_transaction_in_explorer })}`}
      >
        <XStack
          render={platformEnv.isNative ? undefined : 'a'}
          alignSelf="stretch"
          alignItems="center"
          cursor="pointer"
        >
          <Icon name="OpenOutline" size="$3" color="$iconSubdued" />
        </XStack>
      </Anchor>
    </XStack>
  ) : (
    <PerpBookText
      numberOfLines={1}
      style={[
        textStyle,
        {
          width: timeWidth,
          textAlign: inline ? 'left' : 'right',
          // Align timestamps with linked rows even when a trade has no explorer link.
          paddingRight: !inline && !isHeader ? 14 : 0,
          color: textColor,
        },
      ]}
    >
      {time}
    </PerpBookText>
  );
  const dataRowHeight = inline
    ? ORDER_BOOK_HORIZONTAL_ROW_HEIGHT
    : ORDER_BOOK_VERTICAL_ROW_STEP;
  const headerHeight = inline ? '$8' : '$6';
  return (
    <XStack
      h={isHeader ? headerHeight : dataRowHeight}
      px={inline ? '$5' : '$2'}
      alignItems="center"
    >
      {inline ? timeCell : null}
      {priceCell}
      {sizeCell}
      {inline ? null : timeCell}
    </XStack>
  );
}

const TradeRow = memo(function TradeRow({
  trade,
  szDecimals,
  inline,
}: {
  trade: IRecentTrade;
  szDecimals?: number;
  inline: boolean;
}) {
  const intl = useIntl();
  const isBuy = trade.side === 'B';
  const sideLabel = intl.formatMessage({
    id: isBuy ? ETranslations.global_buy : ETranslations.global_sell,
  });
  const price = formatLocalizedNumberString(new BigNumber(trade.px).toFixed());
  const size =
    szDecimals === undefined
      ? trade.sz
      : new BigNumber(trade.sz).toFixed(szDecimals);

  return (
    <TradeLine
      price={price}
      priceLabel={`${sideLabel} ${price}`}
      size={formatLocalizedNumberString(size)}
      time={formatTime(new Date(trade.time), { formatTemplate: 'HH:mm:ss' })}
      hash={trade.hash}
      side={trade.side}
      inline={inline}
    />
  );
});

function RecentTradesList({
  coin,
  szDecimals,
  inline,
  active,
  visible,
  loadingMinHeight,
}: {
  coin: string;
  szDecimals?: number;
  inline: boolean;
  active: boolean;
  visible: boolean;
  loadingMinHeight?: number;
}) {
  const intl = useIntl();
  const { trades, isLoading, isError, isDisconnected, retry } =
    usePerpPublicTrades(coin, active);
  if (!visible) return null;
  const hasStatus = isError || isDisconnected;
  const showInitialLoading =
    active && isLoading && trades.length === 0 && !hasStatus;
  const inlineMinHeight =
    showInitialLoading && loadingMinHeight ? loadingMinHeight : '$20';
  const rows = trades.map((trade) => (
    <TradeRow
      key={`${trade.time}:${trade.tid}`}
      trade={trade}
      inline={inline}
      szDecimals={szDecimals}
    />
  ));
  const listContent = inline ? (
    rows
  ) : (
    <ScrollView
      testID="perp-recent-trades-scroll"
      flex={1}
      showsVerticalScrollIndicator={false}
    >
      {rows}
    </ScrollView>
  );

  return (
    <YStack
      flex={inline ? undefined : 1}
      minHeight={inline ? inlineMinHeight : 0}
      testID="perp-recent-trades"
      aria-busy={active && isLoading}
    >
      <TradeLine
        inline={inline}
        price={intl.formatMessage({ id: ETranslations.perp_orderbook_price })}
        size={intl.formatMessage({ id: ETranslations.perp_orderbook_size })}
        time={intl.formatMessage({ id: ETranslations.global_time })}
      />

      {hasStatus ? (
        <XStack
          px={inline ? '$5' : '$2'}
          py="$1"
          alignItems="center"
          justifyContent="space-between"
          bg="$bgSubdued"
        >
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({
              id: isDisconnected
                ? ETranslations.perp_offline
                : ETranslations.global_network_error,
            })}
          </SizableText>
          <Button
            testID="perp-recent-trades-retry"
            size="small"
            variant="tertiary"
            onPress={retry}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        </XStack>
      ) : null}

      {trades.length > 0 ? (
        listContent
      ) : (
        <YStack flex={1} alignItems="center" justifyContent="center">
          {isLoading && !hasStatus ? <Spinner /> : null}
          {!isLoading && !hasStatus ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_no_data })}
            </SizableText>
          ) : null}
        </YStack>
      )}
    </YStack>
  );
}

export function PerpRecentTrades({
  inline = false,
  active = true,
  visible = true,
  loadingMinHeight,
}: {
  inline?: boolean;
  active?: boolean;
  visible?: boolean;
  loadingMinHeight?: number;
}) {
  const [instrument] = useActiveTradeInstrumentAtom();
  const isFocused = useIsFocused();
  const [isVisible, setIsVisible] = useState(getCurrentVisibilityState);
  useVisibilityChange(setIsVisible);
  return instrument.mode === 'perp' && instrument.coin ? (
    <RecentTradesList
      key={instrument.coin}
      coin={instrument.coin}
      szDecimals={instrument.universe?.szDecimals}
      inline={inline}
      active={active && isVisible && isFocused}
      visible={visible}
      loadingMinHeight={loadingMinHeight}
    />
  ) : null;
}
