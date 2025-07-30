import type {
  ISizableTextProps,
  IXStackProps,
  IYStackProps,
} from '@onekeyhq/components';
import { Popover, SizableText, XStack, YStack } from '@onekeyhq/components';

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
    <SizableText color="$textSubdued" flex={1} flexWrap="wrap" {...rest}>
      {children}
    </SizableText>
  );
  return tooltip ? (
    <XStack gap="$1" ai="center" maxWidth="50%" flex={1}>
      <SizableText color="$textSubdued" flexWrap="wrap" {...rest}>
        {children}
      </SizableText>
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

/**
 * @deprecated Use XStack or YStack with SizableText instead.
 * Text components cannot render non-text elements as children,
 * as nesting may cause rendering failures on native platforms.
 */
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
