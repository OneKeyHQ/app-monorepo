import { memo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Checkbox,
  Dialog,
  Icon,
  IconButton,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { SwapStepStatusIcon } from '@onekeyhq/kit/src/views/Swap/components/PreSwapStep';
import { formatSwapErrorMessage } from '@onekeyhq/kit/src/views/Swap/utils/swapErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IDustSweepItem,
  IDustSweepReason,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapErrorMessage } from '@onekeyhq/shared/types/swap/types';

export const DUST_SWEEP_ROW_HEIGHT = 60;
export const DUST_SWEEP_TOKEN_SIZE = 32;

export const dustSweepReasonMessageIds: Record<
  IDustSweepReason,
  ETranslations
> = {
  priceImpact: ETranslations.toast_price_impact_exceeded_skipped,
  valueDrop: ETranslations.global_unknown_error,
  noQuote: ETranslations.swap_page_provider_rate_unavailable,
  insufficientGas: ETranslations.insufficient_native_for_network_fees__msg,
  insufficientBalance: ETranslations.swap_page_button_insufficient_balance,
  txFailed: ETranslations.swap_review_transaction_failed,
  unknown: ETranslations.global_unknown_error,
};

export function getDustSweepReasonMessage(
  intl: ReturnType<typeof useIntl>,
  reason: IDustSweepReason,
  nativeTokenSymbol?: string,
  providerErrorMessage?: string,
  localError?: ISwapErrorMessage,
) {
  if (providerErrorMessage?.trim()) return providerErrorMessage.trim();
  if (localError) {
    const { title, message } = formatSwapErrorMessage(intl, localError);
    return [title, message].filter(Boolean).join('\n');
  }
  if (reason === 'insufficientGas') {
    const symbol = nativeTokenSymbol?.trim();
    return symbol
      ? intl.formatMessage(
          { id: dustSweepReasonMessageIds[reason] },
          { symbol },
        )
      : intl.formatMessage({
          id: ETranslations.swap_page_button_insufficient_balance,
        });
  }
  return intl.formatMessage({ id: dustSweepReasonMessageIds[reason] });
}

// The reason a token row shows; the result breakdown groups by the same text.
export function getDustSweepItemReasonMessage(
  intl: ReturnType<typeof useIntl>,
  item: IDustSweepItem,
  nativeTokenSymbol?: string,
) {
  return getDustSweepReasonMessage(
    intl,
    item.reason ?? 'unknown',
    nativeTokenSymbol,
    item.providerErrorMessage,
    item.localError,
  );
}

const DustSweepTokenRowBase = ({
  token,
  selected,
  item,
  paused,
  onToggle,
  nativeTokenSymbol,
}: {
  token?: IDustSweepToken;
  selected?: boolean;
  item?: IDustSweepItem;
  paused?: boolean;
  onToggle?: (key: string) => void;
  nativeTokenSymbol?: string;
}) => {
  const intl = useIntl();
  let reasonDescription: string | undefined;
  if (item)
    reasonDescription =
      item.submissionErrorMessage ||
      (item.status === 'unknown' && !item.localError
        ? intl.formatMessage({ id: ETranslations.swap_review_tx_pending })
        : getDustSweepItemReasonMessage(intl, item, nativeTokenSymbol));
  // Errors only surface once the sweep starts, as the leading status icon.
  const unverified = !!token?.suspicious && !item;
  let statusLabel = token?.name;
  if (unverified)
    statusLabel = intl.formatMessage({ id: ETranslations.global_unverified });
  if (item?.status === 'preparing')
    statusLabel = intl.formatMessage({ id: ETranslations.global_processing });
  else if (item?.status === 'signing')
    statusLabel = intl.formatMessage({
      id: ETranslations.swap_review_sign_and_submit,
    });
  else if (item?.status === 'broadcasted' || item?.status === 'unknown')
    statusLabel = intl.formatMessage({ id: ETranslations.global_pending });
  let statusIcon;
  if (item) {
    if (
      ['preparing', 'signing', 'broadcasted'].includes(item.status) &&
      !item.submissionErrorMessage &&
      !item.providerErrorMessage &&
      !item.localError
    )
      statusIcon = (
        <SwapStepStatusIcon isLoading success={false} failed={false} />
      );
    else if (item.status === 'success')
      statusIcon = (
        <SwapStepStatusIcon isLoading={false} success failed={false} />
      );
    else if (
      ['failed', 'skipped', 'unknown'].includes(item.status) ||
      item.submissionErrorMessage ||
      item.providerErrorMessage ||
      item.localError
    )
      statusIcon = (
        <Tooltip
          renderTrigger={
            <IconButton
              testID={`dust-sweep-reason-${token?.key}`}
              icon={
                item.status === 'unknown' && !item.submissionErrorMessage
                  ? 'ClockTimeHistoryOutline'
                  : 'InfoCircleSolid'
              }
              iconProps={{
                color:
                  item.status === 'unknown' && !item.submissionErrorMessage
                    ? '$iconSubdued'
                    : '$iconCritical',
              }}
              size="small"
              variant="tertiary"
              mx={0}
              my={0}
              p={0}
              width={20}
              height={20}
              minHeight={20}
              hitSlop={12}
              accessibilityLabel={reasonDescription}
              onPress={
                platformEnv.isNative
                  ? () => {
                      Dialog.show({
                        title: token?.symbol,
                        description: reasonDescription,
                        showCancelButton: false,
                        onConfirmText: intl.formatMessage({
                          id: ETranslations.global_got_it,
                        }),
                      });
                    }
                  : undefined
              }
            />
          }
          renderContent={reasonDescription}
        />
      );
    else
      statusIcon = (
        <Icon
          name={paused ? 'PauseOutline' : 'ClockTimeHistoryOutline'}
          color="$iconSubdued"
          size="$5"
        />
      );
  }
  return (
    <XStack
      testID={token ? `dust-sweep-row-${token.key}` : 'dust-sweep-row-skeleton'}
      height={DUST_SWEEP_ROW_HEIGHT}
      minHeight={DUST_SWEEP_ROW_HEIGHT}
      px="$5"
      py="$2"
      gap="$3"
      alignItems="center"
    >
      <Stack width={20} height={32} alignItems="center" justifyContent="center">
        {!token ? <Skeleton width={20} height={20} /> : null}
        {token && item ? statusIcon : null}
        {token && !item ? (
          <Checkbox
            testID={`dust-sweep-select-${token.key}`}
            value={!!selected}
            width={20}
            height={20}
            minHeight={20}
            flexShrink={0}
            containerProps={{ py: '$1', flexShrink: 0 }}
            onChange={() => onToggle?.(token.key)}
          />
        ) : null}
      </Stack>
      <Stack width={DUST_SWEEP_TOKEN_SIZE} height={DUST_SWEEP_TOKEN_SIZE}>
        {token ? (
          <Token
            size="md"
            tokenImageUri={token.logoURI}
            networkId={token.networkId}
            showNetworkIcon
          />
        ) : (
          <Skeleton width={32} height={32} radius="round" />
        )}
      </Stack>
      <YStack flex={1} minWidth={0} height={44} justifyContent="center">
        {token ? (
          <>
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {token.symbol}
            </SizableText>
            <SizableText
              size="$bodyMd"
              color={unverified ? '$textCaution' : '$textSubdued'}
              numberOfLines={1}
            >
              {statusLabel}
            </SizableText>
          </>
        ) : (
          <>
            <Stack height={24} justifyContent="center">
              <Skeleton width={56} height={16} />
            </Stack>
            <Stack height={20} justifyContent="center">
              <Skeleton width={88} height={12} />
            </Stack>
          </>
        )}
      </YStack>
      <YStack minWidth={88} maxWidth="48%" height={44} alignItems="flex-end">
        {token ? (
          <>
            <NumberSizeableText
              size="$bodyLgMedium"
              formatter="balance"
              numberOfLines={1}
            >
              {new BigNumber(token.amount)
                .times(token.balanceMultiplier ?? 1)
                .toFixed()}
            </NumberSizeableText>
            <Currency
              size="$bodyMd"
              color="$textSubdued"
              sourceCurrency="usd"
              formatter="value"
            >
              {token.valueUsd}
            </Currency>
          </>
        ) : (
          <>
            <Stack height={24} justifyContent="center">
              <Skeleton width={80} height={16} />
            </Stack>
            <Stack height={20} justifyContent="center">
              <Skeleton width={52} height={12} />
            </Stack>
          </>
        )}
      </YStack>
    </XStack>
  );
};

DustSweepTokenRowBase.displayName = 'DustSweepTokenRow';

export const DustSweepTokenRow = memo(DustSweepTokenRowBase);

DustSweepTokenRow.displayName = 'DustSweepTokenRow';
