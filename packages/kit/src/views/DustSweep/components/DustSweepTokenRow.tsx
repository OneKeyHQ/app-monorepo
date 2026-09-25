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
  Spinner,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IDustSweepItem,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';

export const DUST_SWEEP_ROW_HEIGHT = 60;
export const DUST_SWEEP_TOKEN_SIZE = 32;

const reasonKeys = {
  priceImpact: ETranslations.toast_price_impact_exceeded_skipped,
  valueDrop: ETranslations.swap_page_price_impact_title,
  noQuote: ETranslations.swap_page_provider_rate_unavailable,
  insufficientGas: ETranslations.swap_page_button_insufficient_balance,
  txFailed: ETranslations.swap_review_transaction_failed,
  unknown: ETranslations.global_unknown_error,
};

export const DustSweepTokenRow = memo(function DustSweepTokenRow({
  token,
  selected,
  item,
  paused,
  onToggle,
}: {
  token?: IDustSweepToken;
  selected?: boolean;
  item?: IDustSweepItem;
  paused?: boolean;
  onToggle?: () => void;
}) {
  const intl = useIntl();
  const reasonText = intl.formatMessage({
    id:
      item?.status === 'unknown'
        ? ETranslations.global_pending
        : reasonKeys[item?.reason ?? 'unknown'],
  });
  const reasonDescription =
    item?.status === 'skipped' && item.reason !== 'priceImpact'
      ? `${reasonText} · ${intl.formatMessage({ id: ETranslations.label_skipped })}`
      : reasonText;
  let statusIcon;
  if (item) {
    if (['preparing', 'signing', 'broadcasted'].includes(item.status))
      statusIcon = <Spinner size="small" />;
    else if (item.status === 'success')
      statusIcon = (
        <Icon name="CheckRadioSolid" color="$iconSuccess" size="$5" />
      );
    else if (['failed', 'skipped', 'unknown'].includes(item.status))
      statusIcon = (
        <Tooltip
          renderTrigger={
            <IconButton
              testID={`dust-sweep-reason-${token?.key}`}
              icon={
                item.status === 'unknown'
                  ? 'ClockTimeHistoryOutline'
                  : 'XCircleSolid'
              }
              iconColor={
                item.status === 'unknown' ? '$iconSubdued' : '$iconCritical'
              }
              size="small"
              variant="tertiary"
              mx={0}
              my={0}
              p={0}
              width={20}
              height={32}
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
      opacity={token?.suspicious && !item ? 0.5 : 1}
    >
      <Stack width={20} height={32} alignItems="center" justifyContent="center">
        {!token ? <Skeleton width={20} height={20} /> : null}
        {token && item ? statusIcon : null}
        {token && !item ? (
          <Checkbox
            testID={`dust-sweep-select-${token.key}`}
            value={!!selected}
            onChange={onToggle}
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
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={1}>
              {token.name}
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
              targetCurrency="usd"
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
});
