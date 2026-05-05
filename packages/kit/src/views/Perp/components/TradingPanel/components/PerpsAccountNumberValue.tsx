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

import type { FontSizeTokens } from 'tamagui';

export function PerpsAccountNumberValue({
  value,
  skeletonWidth = 60,
  textSize = '$bodySmMedium',
}: {
  value: string;
  skeletonWidth?: number;
  textSize?: FontSizeTokens;
}) {
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [selectedAccount] = usePerpsActiveAccountAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const userAddress = selectedAccount.accountAddress;
  if (perpsAccountLoading?.selectAccountLoading) {
    return <Skeleton width={skeletonWidth} height={16} />;
  }

  if (!accountSummary || !userAddress) {
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
