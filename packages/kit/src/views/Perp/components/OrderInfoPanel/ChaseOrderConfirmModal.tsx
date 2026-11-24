import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Checkbox,
  Dialog,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useBboAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  formatLocalizedNumberString,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { formatPriceToSignificantDigits } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IPerpsFrontendOrder } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpsMarketDataFreshness } from '../../hooks/usePerpsMarketDataFreshness';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';
import { getTifLabel } from '../../utils/timeInForce';

import { getOrderAssetDisplayName, resolveLiveChaseOrderPrice } from './utils';

import type { IntlShape } from 'react-intl';

interface IChaseOrderConfirmContentProps {
  order: IPerpsFrontendOrder;
  targetQuote: IChaseOrderQuote;
  szDecimals: number;
}

export type IChaseOrderQuote = {
  price: string;
  time: number;
} & (
  | { source: 'live'; localReceivedAt?: number }
  | {
      source: 'rest';
      receivedAt: number;
      receivedAtWallTime: number;
      ageAtReceiptMs: number;
    }
);

export function resolveLiveChaseOrderQuote(
  params: Parameters<typeof resolveLiveChaseOrderPrice>[0],
): IChaseOrderQuote | undefined {
  const price = resolveLiveChaseOrderPrice(params);
  if (!params.bbo || !price) {
    return undefined;
  }
  return {
    price,
    time: params.bbo.time,
    localReceivedAt: params.bbo.localReceivedAt,
    source: 'live',
  };
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

function ChaseOrderConfirmContent({
  order,
  targetQuote,
  szDecimals,
  onQuoteRendered,
}: IChaseOrderConfirmContentProps & {
  onQuoteRendered: (
    quote: IChaseOrderQuote,
    updateQuote: (quote: IChaseOrderQuote) => void,
  ) => void;
}) {
  const intl = useIntl();
  const [bbo] = useBboAtom();
  const { isReady } = usePerpsMarketDataFreshness();
  const [quote, setQuote] = useState(targetQuote);
  const lastRenderedQuote = useRef(targetQuote);
  const fallbackQuote =
    lastRenderedQuote.current.time >= quote.time
      ? lastRenderedQuote.current
      : quote;
  const liveQuote = isReady
    ? resolveLiveChaseOrderQuote({
        bbo,
        order,
        szDecimals,
        minBboTime: fallbackQuote.time,
      })
    : undefined;
  // Equal exchange timestamps must retain the age of the rendered quote.
  const quoteForAge =
    liveQuote && liveQuote.time > fallbackQuote.time
      ? liveQuote
      : fallbackQuote;
  const displayedTargetPrice = formatPriceToSignificantDigits(
    liveQuote?.price ?? quoteForAge.price,
    szDecimals,
  );
  useLayoutEffect(() => {
    const renderedQuote = { ...quoteForAge, price: displayedTargetPrice };
    lastRenderedQuote.current = renderedQuote;
    onQuoteRendered(renderedQuote, setQuote);
  }, [quoteForAge, displayedTargetPrice, onQuoteRendered, quote]);
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
        <ChaseOrderConfirmRow
          label={intl.formatMessage({
            id: ETranslations.perp_chase_target_price__title,
          })}
          value={`$${formatLocalizedNumberString(displayedTargetPrice)}`}
        />
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
      <YStack pt={platformEnv.isNative ? '$2' : 0}>
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
    </YStack>
  );
}

export function showChaseOrderConfirmDialog({
  order,
  targetQuote,
  szDecimals,
  intl,
  onConfirm,
}: IChaseOrderConfirmContentProps & {
  intl: IntlShape;
  onConfirm: (
    quote: IChaseOrderQuote,
    updateQuote: (quote: IChaseOrderQuote) => void,
  ) => Promise<boolean>;
}) {
  let rendered:
    | {
        quote: IChaseOrderQuote;
        updateQuote: (quote: IChaseOrderQuote) => void;
      }
    | undefined;
  let confirming = false;
  return Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.confirm_chase_order__title,
    }),
    description: intl.formatMessage({
      id: ETranslations.chase_order_confirmation__desc,
    }),
    renderContent: (
      <PerpsProviderMirror>
        <ChaseOrderConfirmContent
          order={order}
          targetQuote={targetQuote}
          szDecimals={szDecimals}
          onQuoteRendered={(quote, updateQuote) => {
            rendered = { quote, updateQuote };
          }}
        />
      </PerpsProviderMirror>
    ),
    // Web: with the content's $1 padding, match OrderConfirmContent's $4
    // button gap. Native keeps the checkbox's own top spacing instead.
    contentContainerProps: platformEnv.isNative ? undefined : { pb: '$3' },
    showFooter: true,
    showConfirmButton: true,
    showCancelButton: true,
    onConfirm: async ({ preventClose, isExist }) => {
      if (!rendered || confirming) {
        preventClose();
        return;
      }
      const { quote, updateQuote } = rendered;
      confirming = true;
      try {
        const shouldClose = await onConfirm(quote, (replacement) => {
          if (isExist()) {
            // Wait for the replacement to render before accepting another tap.
            rendered = undefined;
            updateQuote(replacement);
            Toast.message({
              title: intl.formatMessage({
                id: ETranslations.buy_error_quote_expired__msg,
              }),
            });
          }
        });
        if (!shouldClose) {
          preventClose();
        }
      } finally {
        confirming = false;
      }
    },
  });
}
