import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IPerpsActiveTwapOrder } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { parseDexCoin } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpTestIDs } from '../../../testIDs';

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

const MobileTwapOpenOrdersRow = memo(
  ({ order, onCancelOrder }: IMobileTwapOpenOrdersRowProps) => {
    const intl = useIntl();
    const { twapId, state } = order;
    const assetSymbol = useMemo(
      () => parseDexCoin(state.coin).displayName,
      [state.coin],
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
      const execution = `${state.minutes}m${
        state.randomize ? ' · Random' : ''
      }`;
      return {
        progressText,
        executedValueFormatted: numberFormat(state.executedNtl, valueFormatter),
        execution,
      };
    }, [state]);

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
        bg="$bgSubdued"
        borderRadius="$3"
      >
        <XStack justifyContent="space-between" width="100%" alignItems="center">
          <YStack flex={1}>
            <SizableText size="$bodyMdMedium">{assetSymbol} · TWAP</SizableText>
            <SizableText size="$bodySm" color={typeColor}>
              {sideText} · {baseInfo.execution}
            </SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {dateInfo.date} {dateInfo.time}
            </SizableText>
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
        <XStack width="100%" justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            Filled
          </SizableText>
          <SizableText size="$bodySm">{baseInfo.progressText}</SizableText>
        </XStack>
        <XStack width="100%" justifyContent="space-between">
          <SizableText size="$bodySm" color="$textSubdued">
            Value
          </SizableText>
          <SizableText size="$bodySm">
            {baseInfo.executedValueFormatted}
          </SizableText>
        </XStack>
      </ListItem>
    );
  },
);

MobileTwapOpenOrdersRow.displayName = 'MobileTwapOpenOrdersRow';
export { MobileTwapOpenOrdersRow };
