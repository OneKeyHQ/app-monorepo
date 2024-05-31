import {
  type INumberSizeableTextProps,
  NumberSizeableText,
  SizableText,
} from '@onekeyhq/components';

export function PriceChangePercentage({
  children,
  ...props
}: INumberSizeableTextProps) {
  return children ? (
    <NumberSizeableText
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
