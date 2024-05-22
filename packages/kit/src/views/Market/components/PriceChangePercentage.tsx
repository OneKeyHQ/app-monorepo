import {
  type INumberSizeableTextProps,
  NumberSizeableText,
} from '@onekeyhq/components';

export function PriceChangePercentage({
  children,
  ...props
}: INumberSizeableTextProps) {
  return (
    <NumberSizeableText
      size="$bodyMd"
      formatter="priceChange"
      color={Number(children) > 0 ? '$textSuccess' : '$textCritical'}
      formatterOptions={{ showPlusMinusSigns: true }}
      {...props}
    >
      {children}
    </NumberSizeableText>
  );
}
