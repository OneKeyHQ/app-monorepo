import {
  type INumberSizeableTextProps,
  NumberSizeableText,
  SizableText,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { formatPriceChangeDisplay } from '../MarketDetailV2/utils/statValue';

export function PriceChangePercentage({
  children,
  ...props
}: INumberSizeableTextProps) {
  if (
    typeof children === 'undefined' ||
    children === null ||
    (typeof children === 'string' && children.length === 0)
  ) {
    return <SizableText size="$bodyMd">-</SizableText>;
  }

  const { color } = formatPriceChangeDisplay(children);

  return (
    <NumberSizeableText
      adjustsFontSizeToFit
      numberOfLines={platformEnv.isNative ? 1 : 2}
      userSelect="none"
      size="$bodyMd"
      formatter="priceChange"
      color={color}
      formatterOptions={{ showPlusMinusSigns: true }}
      {...props}
    >
      {children}
    </NumberSizeableText>
  );
}
