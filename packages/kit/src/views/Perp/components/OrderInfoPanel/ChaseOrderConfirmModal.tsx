import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import {
  formatLocalizedNumberString,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatPriceToSignificantDigits,
  resolveBboOrderPrice,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { getTifLabel } from '../../utils/timeInForce';

import { getOrderAssetDisplayName } from './utils';

import type { IntlShape } from 'react-intl';

interface IChaseOrderConfirmContentProps {
  order: IPerpsFrontendOrder;
  szDecimals: number;
}

function ChaseOrderConfirmRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: '$green11' | '$red11';
}) {
  return (
    <XStack justifyContent="space-between" alignItems="center" gap="$3">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" color={valueColor} textAlign="right">
        {value}
      </SizableText>
    </XStack>
  );
}

function ChaseOrderTargetPrice({
  order,
  szDecimals,
}: IChaseOrderConfirmContentProps) {
  const intl = useIntl();
  const [price, setPrice] = useState<string>();
  useEffect(() => {
    const params = { coin: order.coin, subscriptionId: generateUUID() };
    let disposed = false;
    let acquired = false;
    setPrice(undefined);
    const onUpdate = (
      data: IAppEventBusPayload[EAppEventBusNames.PerpsChaseOrderBookUpdate],
    ) => {
      if (
        disposed ||
        data.coin !== order.coin ||
        data.subscriptionId !== params.subscriptionId
      )
        return;
      const nextPrice =
        data.bestBid && data.bestAsk
          ? resolveBboOrderPrice({
              bid: data.bestBid,
              ask: data.bestAsk,
              side: order.side === 'B' ? 'long' : 'short',
              type: 'queue',
              offsetTicks: 0,
              szDecimals,
            })?.toFixed()
          : undefined;
      setPrice(nextPrice);
    };
    const release = () => {
      if (!acquired) return;
      acquired = false;
      void backgroundApiProxy.serviceHyperliquidSubscription
        .unsubscribeChaseOrderBook(params)
        .catch(() => undefined);
    };
    appEventBus.on(EAppEventBusNames.PerpsChaseOrderBookUpdate, onUpdate);
    void backgroundApiProxy.serviceHyperliquidSubscription
      .subscribeChaseOrderBook(params)
      .then(() => {
        acquired = true;
        if (disposed) release();
      })
      .catch(() => {
        if (!disposed) setPrice(undefined);
      });
    return () => {
      disposed = true;
      appEventBus.off(EAppEventBusNames.PerpsChaseOrderBookUpdate, onUpdate);
      release();
    };
  }, [order.coin, order.side, szDecimals]);
  return (
    <ChaseOrderConfirmRow
      label={intl.formatMessage({
        id: ETranslations.perp_chase_target_price__title,
      })}
      value={
        price
          ? `$${formatLocalizedNumberString(formatPriceToSignificantDigits(price, szDecimals))}`
          : '--'
      }
    />
  );
}

function ChaseOrderConfirmContent({
  order,
  szDecimals,
}: IChaseOrderConfirmContentProps) {
  const intl = useIntl();
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const assetDisplayName = getOrderAssetDisplayName(order.coin, {});
  const direction = useMemo(() => {
    if (order.side === 'B') {
      return order.reduceOnly
        ? intl.formatMessage({
            id: ETranslations.perp_order_close_short,
          })
        : intl.formatMessage({ id: ETranslations.perp_long });
    }
    return order.reduceOnly
      ? intl.formatMessage({
          id: ETranslations.perp_order_close_long,
        })
      : intl.formatMessage({ id: ETranslations.perp_short });
  }, [intl, order.reduceOnly, order.side]);
  const formatPrice = useCallback(
    (price: string) =>
      `$${formatLocalizedNumberString(
        formatPriceToSignificantDigits(price, szDecimals),
      )}`,
    [szDecimals],
  );
  const sizeDisplay = `${numberFormat(order.sz, {
    formatter: 'balance',
  })} ${assetDisplayName}`;
  const yesText = intl.formatMessage({
    id: ETranslations.perp_yes__title,
  });
  const noText = intl.formatMessage({
    id: ETranslations.perp_no__title,
  });

  return (
    <YStack gap="$4" p="$1">
      <YStack gap="$3">
        <ChaseOrderConfirmRow
          label={intl.formatMessage({
            id: ETranslations.perp_token_selector_asset,
          })}
          value={assetDisplayName}
        />
        <ChaseOrderConfirmRow
          label={intl.formatMessage({
            id: ETranslations.perp_direction__title,
          })}
          value={direction}
          valueColor={order.side === 'B' ? '$green11' : '$red11'}
        />
        <ChaseOrderConfirmRow
          label={intl.formatMessage({
            id: ETranslations.perp_chase_current_order_price__title,
          })}
          value={formatPrice(order.limitPx)}
        />
        <ChaseOrderTargetPrice order={order} szDecimals={szDecimals} />
        <ChaseOrderConfirmRow
          label={intl.formatMessage({
            id: ETranslations.perp_chase_unfilled_size__title,
          })}
          value={sizeDisplay}
        />
        <ChaseOrderConfirmRow
          label={intl.formatMessage({
            id: ETranslations.perp_time_in_force__title,
          })}
          value={getTifLabel('Alo') ?? 'ALO'}
        />
        <ChaseOrderConfirmRow
          label={intl.formatMessage({
            id: ETranslations.perps_reduce_only,
          })}
          value={order.reduceOnly ? yesText : noText}
        />
      </YStack>
      <Checkbox
        testID="perp-chase-order-confirm-checkbox"
        labelProps={{
          fontSize: '$bodyMdMedium',
          color: '$textSubdued',
        }}
        label={intl.formatMessage({
          id: ETranslations.perp_confirm_not_show,
        })}
        value={perpsCustomSettings.skipOrderConfirm}
        onChange={(checked) =>
          setPerpsCustomSettings((previous) => ({
            ...previous,
            skipOrderConfirm: Boolean(checked),
          }))
        }
      />
    </YStack>
  );
}

export function showChaseOrderConfirmDialog({
  order,
  szDecimals,
  intl,
  onConfirm,
}: IChaseOrderConfirmContentProps & {
  intl: IntlShape;
  onConfirm: () => Promise<void>;
}) {
  return Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.confirm_chase_order__title,
    }),
    description: intl.formatMessage({
      id: ETranslations.chase_order_confirmation__desc,
    }),
    renderContent: (
      <ChaseOrderConfirmContent order={order} szDecimals={szDecimals} />
    ),
    // Together with the content's $1 padding, match OrderConfirmContent's $4 button gap.
    contentContainerProps: { pb: '$3' },
    showFooter: true,
    showConfirmButton: true,
    showCancelButton: true,
    onConfirm,
  });
}
