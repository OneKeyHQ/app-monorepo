import {
  NumberSizeableText,
  SizableText,
  Skeleton,
} from '@onekeyhq/components';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountStatusAtom,
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
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [selectedAccount] = usePerpsActiveAccountAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const userAddress = selectedAccount.accountAddress;
  if (perpsAccountLoading?.selectAccountLoading) {
    return <Skeleton width={skeletonWidth} height={16} />;
  }

  if (
    !accountSummary ||
    perpsAccountStatus?.accountNotSupport ||
    !userAddress
  ) {
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
