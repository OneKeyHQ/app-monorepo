import { memo, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IPerpsActiveTwapOrder } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  useSpotPairDisplayMapAtom,
  useSpotPairDisplayNameMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatLocalizedNumberString,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { getValidPriceDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpTestIDs } from '../../../testIDs';
import { getOrderAssetDisplayName } from '../utils';

const balanceFormatter: INumberFormatProps = {
  formatter: 'balance',
};

const valueFormatter: INumberFormatProps = {
  formatter: 'balance',
  formatterOptions: {
    currency: '$',
  },
};

interface IMobileTwapOpenOrdersRowProps {
  order: IPerpsActiveTwapOrder;
  onCancelOrder: () => void;
}

function formatElapsedDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function formatTotalDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

function MobileTwapInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack width="100%" alignItems="center" justifyContent="space-between">
      <SizableText size="$bodySm">{label}</SizableText>
      <SizableText
        size="$bodySm"
        numberOfLines={1}
        ellipsizeMode="tail"
        textAlign="right"
        maxWidth="60%"
      >
        {value}
      </SizableText>
    </XStack>
  );
}

const MobileTwapOpenOrdersRow = memo(
  ({ order, onCancelOrder }: IMobileTwapOpenOrdersRowProps) => {
    const intl = useIntl();
    const { twapId, state } = order;
    const [now, setNow] = useState(Date.now());
    const [spotDisplayMap] = useSpotPairDisplayMapAtom();
    const [spotPairDisplayNameMap] = useSpotPairDisplayNameMapAtom();

    useEffect(() => {
      const timer = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timer);
    }, []);

    const assetSymbol = useMemo(
      () =>
        getOrderAssetDisplayName(
          state.coin,
          spotDisplayMap,
          spotPairDisplayNameMap,
        ),
      [spotDisplayMap, spotPairDisplayNameMap, state.coin],
    );
    const dateInfo = useMemo(() => {
      const timeDate = new Date(state.timestamp);
      const date = formatTime(timeDate, {
        formatTemplate: 'yyyy-LL-dd',
      });
      const time = formatTime(timeDate, {
        formatTemplate: 'HH:mm:ss',
      });
      return { date, time };
    }, [state.timestamp]);

    const baseInfo = useMemo(() => {
      const executedSize = new BigNumber(state.executedSz);
      const totalSize = new BigNumber(state.sz);
      const executedNotional = new BigNumber(state.executedNtl);
      const avgPrice =
        executedSize.gt(0) && executedNotional.gte(0)
          ? executedNotional.dividedBy(executedSize)
          : undefined;
      const avgPriceValue = avgPrice?.isFinite()
        ? avgPrice.toFixed(getValidPriceDecimals(avgPrice.toFixed()))
        : undefined;
      const progressPercent =
        totalSize.gt(0) && executedSize.gte(0)
          ? BigNumber.min(executedSize.dividedBy(totalSize), 1)
              .multipliedBy(100)
              .toFixed(0)
          : undefined;
      const progressText =
        totalSize.gt(0) && executedSize.gte(0)
          ? `${numberFormat(
              executedSize.toFixed(),
              balanceFormatter,
            )} / ${numberFormat(totalSize.toFixed(), balanceFormatter)}${
              progressPercent ? ` · ${progressPercent}%` : ''
            }`
          : `${state.executedSz} / ${state.sz}`;
      const minuteUnit = intl
        .formatMessage({ id: ETranslations.Limit_expire_minutes })
        .toLowerCase();
      const execution = `${state.minutes} ${minuteUnit}${
        state.randomize
          ? ` · ${intl.formatMessage({ id: ETranslations.global_randomized })}`
          : ''
      }`;
      const elapsedMs = Math.min(
        Math.max(now - state.timestamp, 0),
        state.minutes * 60_000,
      );
      return {
        progressText,
        avgPriceFormatted: avgPriceValue
          ? formatLocalizedNumberString(avgPriceValue)
          : '--',
        executedValueFormatted: numberFormat(state.executedNtl, valueFormatter),
        execution,
        runningTimeText: `${formatElapsedDuration(
          elapsedMs,
        )} / ${formatTotalDuration(state.minutes)}`,
        reduceOnlyText: state.reduceOnly
          ? intl.formatMessage({ id: ETranslations.perp_yes__title })
          : intl.formatMessage({ id: ETranslations.perp_no__title }),
      };
    }, [intl, now, state]);

    const sideText = useMemo(() => {
      if (state.side === 'B') {
        return state.reduceOnly
          ? intl.formatMessage({ id: ETranslations.perp_order_close_short })
          : intl.formatMessage({ id: ETranslations.perp_long });
      }
      return state.reduceOnly
        ? intl.formatMessage({ id: ETranslations.perp_order_close_long })
        : intl.formatMessage({ id: ETranslations.perp_short });
    }, [intl, state.reduceOnly, state.side]);
    const typeColor = state.side === 'B' ? '$green11' : '$red11';

    return (
      <ListItem
        flex={1}
        mt="$1.5"
        flexDirection="column"
        alignItems="flex-start"
      >
        <XStack justifyContent="space-between" width="100%" alignItems="center">
          <YStack flex={1}>
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {assetSymbol}
            </SizableText>
            <XStack gap="$2" alignItems="center">
              <SizableText
                size="$bodySm"
                color={typeColor}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {`${intl.formatMessage({
                  id: ETranslations.perp_twap_order__title,
                })} / ${sideText}`}
              </SizableText>
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {dateInfo.date} {dateInfo.time}
              </SizableText>
            </XStack>
          </YStack>
          <Button
            testID={PerpTestIDs.CancelOrderButton(twapId)}
            size="small"
            variant="secondary"
            onPress={onCancelOrder}
          >
            <SizableText size="$bodySm">
              {intl.formatMessage({
                id: ETranslations.perp_open_orders_cancel,
              })}
            </SizableText>
          </Button>
        </XStack>
        <YStack width="100%" gap="$2">
          <MobileTwapInfoRow
            label={intl.formatMessage({
              id: ETranslations.perp_twap_filled_total__title,
            })}
            value={baseInfo.progressText}
          />
          <MobileTwapInfoRow
            label={intl.formatMessage({
              id: ETranslations.perp_twap_duration__title,
            })}
            value={baseInfo.execution}
          />
          <MobileTwapInfoRow
            label={intl.formatMessage({
              id: ETranslations.perp_twap_avg_filled_price__title,
            })}
            value={baseInfo.avgPriceFormatted}
          />
          <MobileTwapInfoRow
            label={intl.formatMessage({
              id: ETranslations.perp_twap_total_trade_amount__title,
            })}
            value={baseInfo.executedValueFormatted}
          />
          <MobileTwapInfoRow
            label={intl.formatMessage({ id: ETranslations.perps_reduce_only })}
            value={baseInfo.reduceOnlyText}
          />
          <MobileTwapInfoRow
            label={intl.formatMessage({
              id: ETranslations.perp_twap_running_time__title,
            })}
            value={baseInfo.runningTimeText}
          />
        </YStack>
      </ListItem>
    );
  },
);

MobileTwapOpenOrdersRow.displayName = 'MobileTwapOpenOrdersRow';
export { MobileTwapOpenOrdersRow };
