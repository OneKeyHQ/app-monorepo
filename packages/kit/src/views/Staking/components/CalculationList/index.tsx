import type {
  ISizableTextProps,
  IXStackProps,
  IYStackProps,
} from '@onekeyhq/components';
import {
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

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

function CalculationListItemLabel({
  children,
  tooltip,
  ...rest
}: ISizableTextProps & { tooltip?: string }) {
  const content = (
    <SizableText color="$textSubdued" {...rest}>
      {children}
    </SizableText>
  );
  return tooltip ? (
    <XStack gap="$1" ai="center">
      {content}
      <Popover.Tooltip
        iconSize="$5"
        title={children}
        tooltip={tooltip}
        placement="top"
      />
    </XStack>
  ) : (
    content
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
