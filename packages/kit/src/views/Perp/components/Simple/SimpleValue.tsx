import { Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IIconProps } from '@onekeyhq/components';

export function SimpleValue({
  label,
  value,
  compact = false,
  singleLine = false,
  showChevron = true,
  actionIcon,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  value: string;
  compact?: boolean;
  singleLine?: boolean;
  showChevron?: boolean;
  actionIcon?: IIconProps['name'];
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <XStack
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { disabled } : undefined}
      gap="$3"
      minHeight={compact ? 32 : 40}
      alignItems="center"
      flexWrap={singleLine ? 'nowrap' : 'wrap'}
      alignContent="center"
      justifyContent="space-between"
    >
      <XStack gap="$3" alignItems="center" flexShrink={singleLine ? 0 : 1}>
        <SizableText
          size={compact ? '$bodyMd' : '$bodyLg'}
          color="$textSubdued"
        >
          {label}
        </SizableText>
      </XStack>
      <XStack
        gap="$2"
        alignItems="center"
        {...(singleLine && {
          flex: 1,
          minWidth: 0,
          justifyContent: 'flex-end',
        })}
      >
        <SizableText
          size={compact ? '$bodyMdMedium' : '$bodyLgMedium'}
          color="$text"
          {...(singleLine && {
            flexShrink: 1,
            minWidth: 0,
            numberOfLines: 1,
            adjustsFontSizeToFit: true,
            minimumFontScale: 0.65,
            textAlign: 'right',
            accessibilityLabel: value,
          })}
        >
          {value}
        </SizableText>
        {onPress && (actionIcon || showChevron) ? (
          <Icon
            name={actionIcon ?? 'ChevronRightSmallOutline'}
            size="$4"
            color="$iconSubdued"
          />
        ) : null}
      </XStack>
    </XStack>
  );
}
