import {
  type INumberSizeableTextProps,
  NumberSizeableText,
  SizableText,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function PriceChangePercentage({
  children,
  ...props
}: INumberSizeableTextProps) {
  return children ? (
    <NumberSizeableText
      adjustsFontSizeToFit
      numberOfLines={platformEnv.isNative ? 1 : 2}
      userSelect="none"
      size="$bodyMd"
      formatter="priceChange"
      color={Number(children) > 0 ? '$textSuccess' : '$textCritical'}
      formatterOptions={{ showPlusMinusSigns: true }}
      {...props}
    >
      {children}
    </NumberSizeableText>
  ) : (
    <SizableText size="$bodyMd">-</SizableText>
  );
}
