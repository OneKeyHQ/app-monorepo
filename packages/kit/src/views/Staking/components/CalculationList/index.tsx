import type {
  ISizableTextProps,
  IXStackProps,
  IYStackProps,
} from '@onekeyhq/components';
import { SizableText, XStack, YStack } from '@onekeyhq/components';

function CalculationList({ children }: IYStackProps) {
  return <YStack gap="$4">{children}</YStack>;
}

function CalculationListItem({ children, ...rest }: IXStackProps) {
  return (
    <XStack
      animation="quick"
      enterStyle={{ opacity: 0 }}
      justifyContent="space-between"
      alignItems="center"
      {...rest}
    >
      {children}
    </XStack>
  );
}

function CalculationListItemLabel({ children, ...rest }: ISizableTextProps) {
  return (
    <SizableText color="$textSubdued" {...rest}>
      {children}
    </SizableText>
  );
}

function CalculationListItemValue({ children, ...rest }: ISizableTextProps) {
  return (
    <SizableText size="$bodyLgMedium" {...rest}>
      {children}
    </SizableText>
  );
}

CalculationList.Item = CalculationListItem;
CalculationListItem.Label = CalculationListItemLabel;
CalculationListItem.Value = CalculationListItemValue;

export { CalculationList, CalculationListItem };
