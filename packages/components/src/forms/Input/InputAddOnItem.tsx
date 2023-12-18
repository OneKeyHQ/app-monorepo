import { Icon, SizableText, Spinner, XStack, YStack } from '../../primitives';

import type { IInputProps } from '.';
import type { IKeyOfIcons, IXStackProps } from '../../primitives';
import type { ColorTokens } from 'tamagui';

export interface IInputAddOnProps extends IXStackProps {
  label?: string;
  iconName?: IKeyOfIcons;
  iconColor?: ColorTokens;
  addOnSize?: IInputProps['size'];
  loading?: boolean;
  isAddOnDisabled?: IInputProps['disabled'];
}

export function InputAddOnItem({
  label,
  addOnSize,
  isAddOnDisabled,
  iconColor,
  iconName,
  onPress,
  loading,
  ...rest
}: IInputAddOnProps) {
  return (
    <XStack
      alignItems="center"
      px={addOnSize === 'large' ? '$2.5' : '$2'}
      {...(onPress &&
        !isAddOnDisabled && {
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
        })}
      focusable={!(isAddOnDisabled || loading)}
      {...rest}
    >
      {loading ? (
        <YStack {...(addOnSize !== 'small' && { p: '$0.5' })}>
          <Spinner size="small" />
        </YStack>
      ) : (
        iconName && (
          <Icon
            name={iconName}
            color={iconColor}
            size={addOnSize === 'small' ? '$5' : '$6'}
          />
        )
      )}
      {label && (
        <SizableText
          userSelect="none"
          size={addOnSize === 'small' ? '$bodyMd' : '$bodyLg'}
          ml={iconName ? '$2' : '$0'}
          color={isAddOnDisabled ? '$textDisabled' : '$textSubdued'}
        >
          {label}
        </SizableText>
      )}
    </XStack>
  );
}
