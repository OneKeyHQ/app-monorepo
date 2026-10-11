import { SizableText } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';

// The fixed "USD" unit after a referral amount, set apart from the figure.
// Not translated: it is a currency code, like the amounts it labels.
export function ReferralUsdUnit({
  size = '$bodyMd',
}: {
  size?: ISizableTextProps['size'];
}) {
  return (
    <SizableText size={size} color="$textSubdued" flexShrink={0}>
      USD
    </SizableText>
  );
}
