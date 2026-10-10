import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { markPerpsColdStartPerfOnce } from '@onekeyhq/shared/src/performance/perpsColdStartPerf';

import type { FontSizeTokens } from 'tamagui';

export function PerpsPartialAccountValueWarning() {
  const intl = useIntl();
  const label = `${intl.formatMessage({
    id: ETranslations.export_history_partial__title,
  })}: ${intl.formatMessage({
    id: ETranslations.wallet_partial_price_unavailable,
  })}`;
  return (
    <Tooltip
      renderContent={label}
      renderTrigger={
        <Icon
          name="InfoCircleOutline"
          size="$4"
          color="$iconCaution"
          accessibilityLabel={label}
        />
      }
    />
  );
}

export function PerpsAccountNumberValue({
  value,
  skeletonWidth = 60,
  textSize = '$bodySmMedium',
  allowValueDuringAccountLoading = false,
  skipAccountSummaryCheck = false,
  isPartial = false,
}: {
  value: string;
  skeletonWidth?: number;
  textSize?: FontSizeTokens;
  allowValueDuringAccountLoading?: boolean;
  skipAccountSummaryCheck?: boolean;
  isPartial?: boolean;
}) {
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [selectedAccount] = usePerpsActiveAccountAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const userAddress = selectedAccount.accountAddress;
  useEffect(() => {
    if (
      !perpsAccountLoading?.selectAccountLoading &&
      accountSummary &&
      userAddress
    ) {
      markPerpsColdStartPerfOnce('ui_account_summary_ready', {
        accountAddress: 'set',
      });
    }
  }, [accountSummary, perpsAccountLoading?.selectAccountLoading, userAddress]);
  if (
    perpsAccountLoading?.selectAccountLoading &&
    !allowValueDuringAccountLoading
  ) {
    return <Skeleton width={skeletonWidth} height={16} />;
  }

  if (!skipAccountSummaryCheck && (!accountSummary || !userAddress)) {
    return (
      <SizableText size={textSize} color="$textSubdued">
        N/A
      </SizableText>
    );
  }

  const valueContent = (
    <NumberSizeableText
      size={textSize}
      formatter="value"
      formatterOptions={{ currency: '$' }}
    >
      {value}
    </NumberSizeableText>
  );
  return isPartial ? (
    <XStack alignItems="center" gap="$1">
      {valueContent}
      <PerpsPartialAccountValueWarning />
    </XStack>
  ) : (
    valueContent
  );
}
