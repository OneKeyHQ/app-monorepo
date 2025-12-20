import { SizableText } from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';

export function FiatValue({ fiatValue }: { fiatValue?: string | number }) {
  if (!fiatValue) {
    return null;
  }
  return (
    <>
      <SizableText size="$bodyMd"> (</SizableText>
      <Currency formatter="value" size="$bodyMd">
        {fiatValue}
      </Currency>
      <SizableText size="$bodyMd">)</SizableText>
    </>
  );
}
