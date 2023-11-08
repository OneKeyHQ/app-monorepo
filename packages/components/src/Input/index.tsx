import { type Ref, forwardRef } from 'react';

import { Group, Input as TMInput, getFontSize } from 'tamagui';

import { Icon } from '../Icon';
import { Spinner } from '../Spinner';
import { XStack, YStack } from '../Stack';
import { Text } from '../Text';

import { getSharedInputStyles } from './sharedStyles';

import type { IICON_NAMES } from '../Icon';
import type { GetProps } from 'tamagui';

type TMInputProps = GetProps<typeof TMInput>;

export type InputProps = {
  size?: 'small' | 'medium' | 'large';
  leftIconName?: IICON_NAMES;
  error?: boolean;
  addOns?: {
    iconName?: IICON_NAMES;
    label?: string;
    onPress?: () => void;
    loading?: boolean;
  }[];
} & Omit<TMInputProps, 'size'>;

const SIZE_MAPPINGS = {
  'large': {
    verticalPadding: '$2.5',
    horizontalPadding: '$4',
    paddingLeftWithIcon: '$10',
    height: 46,
    iconLeftPosition: 13,
  },
  'medium': {
    verticalPadding: '$1.5',
    horizontalPadding: '$3',
    paddingLeftWithIcon: '$9',
    height: 38,
    iconLeftPosition: 9,
  },
  'small': {
    verticalPadding: '$1',
    horizontalPadding: '$2',
    paddingLeftWithIcon: '$8',
    height: 30,
    iconLeftPosition: 5,
  },
};

function BaseInput(
  {
    size = 'medium',
    leftIconName,
    addOns,
    disabled,
    editable,
    error,
    ...props
  }: InputProps,
  ref: Ref<any>,
) {
  const {
    verticalPadding,
    horizontalPadding,
    paddingLeftWithIcon,
    height,
    iconLeftPosition,
  } = SIZE_MAPPINGS[size];

  const sharedStyles = getSharedInputStyles({ disabled, editable, error });
  return (
    <Group
      orientation="horizontal"
      borderRadius={size === 'large' ? '$3' : '$2'}
      disablePassBorderRadius={!addOns?.length}
      disabled={disabled}
      flex={1}
    >
      {/* input */}
      <Group.Item>
        <TMInput
          unstyled
          ref={ref}
          flex={1}
          /* 
          use height instead of lineHeight because of a RN issue while render TextInput on iOS
          https://github.com/facebook/react-native/issues/28012
        */
          h={height}
          py={verticalPadding}
          pr={horizontalPadding}
          pl={leftIconName ? paddingLeftWithIcon : horizontalPadding}
          fontSize={
            size === 'small' ? getFontSize('$bodyMd') : getFontSize('$bodyLg')
          }
          color={sharedStyles.color}
          placeholderTextColor={sharedStyles.placeholderTextColor}
          borderWidth={sharedStyles.borderWidth}
          borderColor={sharedStyles.borderColor}
          bg={sharedStyles.backgroundColor}
          selectionColor="$bgPrimary"
          borderRadius={size === 'large' ? '$3' : '$2'}
          borderRightWidth={addOns?.length ? '$0' : '$px'}
          focusStyle={sharedStyles.focusStyle}
          cursor={sharedStyles.cursor}
          {...props}
        />
      </Group.Item>

      {/* left icon */}
      {leftIconName && (
        <Icon
          position="absolute"
          name={leftIconName}
          size="$5"
          top="50%"
          y="$-2.5"
          left={iconLeftPosition}
          color={disabled ? '$iconDisabled' : '$iconSubdued'}
          pointerEvents="none"
        />
      )}

      {/* right elements */}
      {addOns?.length && (
        <Group.Item>
          <Group
            orientation="horizontal"
            borderRadius={size === 'large' ? '$3' : '$2'}
            borderWidth="$px"
            borderLeftWidth="$0"
            borderColor={sharedStyles.borderColor}
            bg={sharedStyles.backgroundColor}
            disabled={disabled}
          >
            {addOns.map(({ iconName, label, onPress, loading }) => (
              <Group.Item>
                <XStack
                  onPress={onPress}
                  key={`${iconName || ''}-${label || ''}`}
                  alignItems="center"
                  px={size === 'large' ? '$2.5' : '$2'}
                  {...(onPress &&
                    !disabled && {
                      hoverStyle: {
                        bg: '$bgHover',
                      },
                      pressStyle: {
                        bg: '$bgActive',
                      },
                    })}
                  focusable={!(disabled || loading)}
                  focusStyle={sharedStyles.focusStyle}
                >
                  {loading ? (
                    <YStack {...(size !== 'small' && { p: '$0.5' })}>
                      <Spinner size="small" />
                    </YStack>
                  ) : (
                    iconName && (
                      <Icon
                        name={iconName}
                        color={disabled ? '$iconDisabled' : '$icon'}
                        size={size === 'small' ? '$5' : '$6'}
                      />
                    )
                  )}
                  {label && (
                    <Text
                      userSelect="none"
                      variant={size === 'small' ? '$bodyMd' : '$bodyLg'}
                      ml={iconName ? '$2' : '$0'}
                      color={sharedStyles.color}
                    >
                      {label}
                    </Text>
                  )}
                </XStack>
              </Group.Item>
            ))}
          </Group>
        </Group.Item>
      )}
    </Group>
  );
}

export const Input = forwardRef(BaseInput);
