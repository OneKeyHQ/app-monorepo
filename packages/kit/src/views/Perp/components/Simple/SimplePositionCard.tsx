import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getTpSlKind } from '@onekeyhq/shared/src/utils/perpsTpSlUtils';
import {
  getHyperliquidTokenImageUris,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsAssetPosition } from '@onekeyhq/shared/types/hyperliquid';

import { usePerpsAccountScopedOpenOrdersByCoin } from '../../hooks/usePerpsAccountScopedOpenOrdersByCoin';
import { useShowPositionShare } from '../../hooks/useShowPositionShare';
import { simplePrice, simpleUsd } from '../../utils/simpleDisplay';
import { showAdjustPositionMarginDialog } from '../OrderInfoPanel/AdjustPositionMarginModal';
import { showSetTpslDialog } from '../OrderInfoPanel/SetTpslModal';

import { SimpleLeverageBadge } from './SimpleLeverageBadge';
import { simplePerpsCardStyle, simplePerpsDividerStyle } from './simpleStyles';
import { SimpleValue } from './SimpleValue';

export function SimplePositionCard({ item }: { item: IPerpsAssetPosition }) {
  const { position } = item;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const actions = useHyperliquidActions();
  const side = new BigNumber(position.szi).gt(0) ? 'long' : 'short';
  const pnl = new BigNumber(position.unrealizedPnl);
  const openOrders = usePerpsAccountScopedOpenOrdersByCoin(position.coin);
  const tpOrder = openOrders.find(
    (order) => order.isPositionTpsl && getTpSlKind(order) === 'tp',
  );
  const slOrder = openOrders.find(
    (order) => order.isPositionTpsl && getTpSlKind(order) === 'sl',
  );
  const pnlColor = pnl.gte(0) ? '$textSuccess' : '$textCritical';
  const roi = new BigNumber(position.returnOnEquity).times(100);
  const editProtection = () =>
    void actions.current.showSetPositionTpslUI({
      position,
      isMobile: true,
      navigation,
      onShowDialog: (params) => showSetTpslDialog({ ...params, intl }),
    });
  return (
    <YStack gap="$3">
      <YStack borderRadius="$6" {...simplePerpsCardStyle} p="$5" gap="$4">
        <YStack gap="$1.5">
          <XStack
            justifyContent="space-between"
            alignItems="baseline"
            gap="$3"
            flexWrap="wrap"
          >
            <XStack gap="$2" alignItems="baseline" flexShrink={1}>
              <XStack
                w="$4"
                h="$4"
                alignSelf="center"
                justifyContent="center"
                alignItems="center"
                bg={side === 'long' ? '$bgAccent' : '$bgCriticalStrong'}
                borderRadius={2}
                flexShrink={0}
              >
                <SizableText
                  size="$bodySmMedium"
                  color={side === 'long' ? '$textInverse' : '$textOnColor'}
                >
                  {intl.formatMessage({
                    id:
                      side === 'long'
                        ? ETranslations.perp_position_b
                        : ETranslations.perp_position_s,
                  })}
                </SizableText>
              </XStack>
              <SizableText
                size="$bodyMdMedium"
                numberOfLines={1}
                flexShrink={1}
              >
                {parseDexCoin(position.coin).displayName}
              </SizableText>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id:
                  position.leverage.type === 'cross'
                    ? ETranslations.perp_trade_cross
                    : ETranslations.perp_trade_isolated,
              })}{' '}
              · {position.leverage.value}×
            </SizableText>
          </XStack>
          <YStack gap="$1.5">
            <XStack
              alignItems="baseline"
              justifyContent="space-between"
              gap="$3"
            >
              <SizableText
                flex={1}
                size="$heading2xl"
                lineHeight={32}
                fontVariant={['tabular-nums']}
                includeFontPadding={false}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {simpleUsd(position.positionValue)}
              </SizableText>
              <SizableText
                flex={1}
                textAlign="right"
                size="$heading2xl"
                lineHeight={32}
                fontVariant={['tabular-nums']}
                includeFontPadding={false}
                color={pnlColor}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {`${pnl.gt(0) ? '+' : ''}${simpleUsd(position.unrealizedPnl)}`}
              </SizableText>
            </XStack>
            <XStack
              alignItems="baseline"
              justifyContent="space-between"
              gap="$3"
            >
              <SizableText
                flex={1}
                size="$bodySm"
                lineHeight={20}
                fontVariant={['tabular-nums']}
                includeFontPadding={false}
                color="$textSubdued"
              >
                {new BigNumber(position.szi).abs().toFormat()}{' '}
                {parseDexCoin(position.coin).displayName}
              </SizableText>
              <SizableText
                flex={1}
                textAlign="right"
                size="$bodySm"
                lineHeight={20}
                fontVariant={['tabular-nums']}
                includeFontPadding={false}
                color={pnlColor}
              >
                {`${roi.gt(0) ? '+' : ''}${roi.isFinite() ? `${roi.toFixed(2)}%` : '--'}`}
              </SizableText>
            </XStack>
          </YStack>
        </YStack>
        <YStack height={1} {...simplePerpsDividerStyle} mx="$-5" />
        <YStack gap="$1">
          <SimpleValue
            compact
            label={intl.formatMessage({
              id: ETranslations.perp_position_entry_price,
            })}
            value={simplePrice(position.entryPx)}
          />
          <SimpleValue
            compact
            label={intl.formatMessage({
              id: ETranslations.perp_position_liq_price,
            })}
            value={
              new BigNumber(position.liquidationPx || '0').isZero()
                ? 'N/A'
                : simplePrice(position.liquidationPx)
            }
          />
          {position.leverage.type === 'isolated' ? (
            <SimpleValue
              testID="perps-simple-position-margin"
              actionIcon="PencilOutline"
              onPress={() =>
                showAdjustPositionMarginDialog({ coin: position.coin, intl })
              }
              compact
              label={intl.formatMessage({
                id: ETranslations.perp_position_margin,
              })}
              value={simpleUsd(position.marginUsed)}
            />
          ) : null}
          <SimpleValue
            testID="perps-simple-position-tpsl"
            actionIcon={tpOrder || slOrder ? 'PencilOutline' : undefined}
            compact
            label={intl.formatMessage({
              id: ETranslations.perp_position_tp_sl,
            })}
            showChevron={false}
            value={
              tpOrder || slOrder
                ? `${tpOrder ? simplePrice(tpOrder.triggerPx) : '--'} / ${slOrder ? simplePrice(slOrder.triggerPx) : '--'}`
                : `+ ${intl.formatMessage({ id: ETranslations.global_add })}`
            }
            onPress={editProtection}
          />
        </YStack>
      </YStack>
    </YStack>
  );
}

export function SimplePositionSummary({
  item,
  onPress,
}: {
  item: IPerpsAssetPosition;
  onPress: () => void;
}) {
  const intl = useIntl();
  const actions = useHyperliquidActions();
  const { showPositionShare } = useShowPositionShare();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const displayValue = (value: string) => (hideValue ? '****' : value);
  const { position } = item;
  const pnl = new BigNumber(position.unrealizedPnl);
  const roi = new BigNumber(position.returnOnEquity).times(100);
  const roiColor = roi.gte(0) ? '$textSuccess' : '$textCritical';
  const isLong = new BigNumber(position.szi).gt(0);
  const pnlColor = pnl.gte(0) ? '$textSuccess' : '$textCritical';
  let pnlDisplay = '--';
  if (pnl.isFinite()) {
    let sign = '';
    if (pnl.gt(0)) sign = '+';
    if (pnl.lt(0)) sign = '-';
    const decimals = pnl.abs().gt(0) && pnl.abs().lt(1) ? 4 : 2;
    pnlDisplay = `${sign}$${pnl.abs().toFormat(decimals)}`;
  }
  const handleShare = async () => {
    try {
      const priceData = await actions.current.getMidPrice({
        coin: position.coin,
      });
      showPositionShare({
        side: isLong ? 'long' : 'short',
        token: position.coin,
        tokenDisplayName: parseDexCoin(position.coin).displayName,
        pnl: position.unrealizedPnl,
        pnlPercent: roi.toFixed(1),
        leverage: position.leverage.value,
        entryPrice: position.entryPx,
        markPrice: priceData?.midFormattedByDecimals ?? '0',
        priceType: 'mark',
      });
    } catch (error) {
      errorToastUtils.toastIfError(error);
    }
  };
  return (
    <Button
      testID={`perps-simple-position-${position.coin}`}
      variant="tertiary"
      borderWidth={0}
      childrenAsText={false}
      height="auto"
      minHeight={72}
      mx="$0"
      my="$0"
      p="$4"
      {...simplePerpsCardStyle}
      borderRadius="$6"
      onPress={onPress}
    >
      <XStack width="100%" gap="$2.5" alignItems="center">
        <Token
          size="lg"
          borderRadius="$full"
          tokenImageUris={getHyperliquidTokenImageUris(position.coin)}
          fallbackIcon="CryptoCoinOutline"
        />
        <YStack flex={1} minWidth={0} gap="$1">
          <XStack gap="$2" alignItems="baseline" justifyContent="space-between">
            <XStack gap="$1.5" alignItems="center" flex={1} minWidth={0}>
              <SizableText
                size="$bodyMdMedium"
                numberOfLines={1}
                flexShrink={1}
              >
                {parseDexCoin(position.coin).displayName}
              </SizableText>
              <SimpleLeverageBadge leverage={position.leverage.value} />
            </XStack>
            <SizableText
              size="$bodyMdMedium"
              color={hideValue ? '$textSubdued' : pnlColor}
              flexShrink={0}
            >
              {hideValue ? '****' : pnlDisplay}
            </SizableText>
          </XStack>
          <XStack gap="$2" alignItems="baseline" justifyContent="space-between">
            <XStack
              gap="$1.5"
              alignItems="baseline"
              flexWrap="wrap"
              flex={1}
              minWidth={0}
            >
              <SizableText
                size="$bodySm"
                color={isLong ? '$textSuccess' : '$textCritical'}
              >
                {intl.formatMessage({
                  id: isLong
                    ? ETranslations.perp_trade_long
                    : ETranslations.perp_trade_short,
                })}
              </SizableText>
              <SizableText size="$bodySm" color="$textDisabled">
                |
              </SizableText>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id:
                    position.leverage.type === 'cross'
                      ? ETranslations.perp_trade_cross
                      : ETranslations.perp_trade_isolated,
                })}
              </SizableText>
            </XStack>
            <SizableText
              size="$bodySm"
              flexShrink={0}
              color={hideValue ? '$textSubdued' : roiColor}
            >
              {displayValue(
                roi.isFinite()
                  ? `${roi.gt(0) ? '+' : ''}${roi.toFixed(2)}%`
                  : '--',
              )}
            </SizableText>
          </XStack>
        </YStack>
        <IconButton
          testID={`perps-simple-position-share-${position.coin}`}
          ml="$0"
          variant="tertiary"
          size="small"
          icon="OpenOutline"
          iconSize="$4"
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.perps_share_position_title,
          })}
          stopPropagation
          disabled={hideValue}
          onPress={handleShare}
        />
      </XStack>
    </Button>
  );
}
