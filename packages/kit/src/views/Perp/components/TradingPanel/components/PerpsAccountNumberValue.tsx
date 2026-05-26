import { useEffect } from 'react';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
} from '@onekeyhq/components';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { markPerpsColdStartPerfOnce } from '@onekeyhq/shared/src/performance/perpsColdStartPerf';

import type { FontSizeTokens } from 'tamagui';

export function PerpsAccountNumberValue({
  value,
  skeletonWidth = 60,
  textSize = '$bodySmMedium',
  allowValueDuringAccountLoading = false,
  skipAccountSummaryCheck = false,
}: {
  value: string;
  skeletonWidth?: number;
  textSize?: FontSizeTokens;
  allowValueDuringAccountLoading?: boolean;
  skipAccountSummaryCheck?: boolean;
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

  return (
    <NumberSizeableText
      size={textSize}
      formatter="value"
      formatterOptions={{ currency: '$' }}
    >
      {value}
    </NumberSizeableText>
  );
}
