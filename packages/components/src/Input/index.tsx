import React, { ComponentProps } from 'react';

import { Input as BaseInput, Divider, Pressable, Text } from 'native-base';

import Icon, { ICON_NAMES } from '../Icon';
import { getTypographyStyleProps } from '../Typography';

type Props = {
  small?: boolean;
  isDisabled?: boolean;
  leftText?: string;
  rightText?: string;
  rightSecondaryText?: string;
  leftIconName?: ICON_NAMES;
  rightIconName?: ICON_NAMES;
  rightSecondaryIconName?: ICON_NAMES;
  onPressLeftText?: () => void;
  onPressRightText?: () => void;
  onPressLeftIcon?: () => void;
  onPressRightIcon?: () => void;
  onPressSecondaryRightText?: () => void;
  onPressSecondaryRightIcon?: () => void;
};

const Input = React.forwardRef<
  typeof BaseInput,
  ComponentProps<typeof BaseInput> & Props
>(
  (
    {
      small,
      isDisabled,
      leftText,
      rightText,
      leftIconName,
      rightIconName,
      rightSecondaryText,
      rightSecondaryIconName,
      onPressLeftText,
      onPressRightText,
      onPressLeftIcon,
      onPressRightIcon,
      onPressSecondaryRightText,
      onPressSecondaryRightIcon,
      ...props
    },
    ref,
  ) => {
    const leftElements: JSX.Element[] = [];
    const rightElements: JSX.Element[] = [];
    const fontSize = small ? 'sm' : 'md';
    const textProps = small
      ? getTypographyStyleProps('Body1')
      : (getTypographyStyleProps('Body2') as Pick<
          ComponentProps<typeof Text>,
          'fontFamily' | 'fontWeight' | 'fontSize' | 'lineHeight'
        >);

    if (leftText) {
      leftElements.push(
        <Text
          ml="2"
          key="leftText"
          fontSize={fontSize}
          color={isDisabled ? 'text-disabled' : 'text-subdued'}
          onPress={onPressLeftText}
        >
          {leftText}
        </Text>,
      );
    }
    if (leftIconName) {
      leftElements.push(
        <Pressable ml="2" onPress={onPressLeftIcon} key="leftIconName">
          <Icon
            size={20}
            name={leftIconName}
            color={isDisabled ? 'text-disabled' : 'text-subdued'}
          />
        </Pressable>,
      );
    }
    if (rightText) {
      rightElements.push(
        <Text
          key="rightText"
          mr="2"
          fontSize={fontSize}
          onPress={onPressRightText}
          color={isDisabled ? 'text-disabled' : 'text-subdued'}
        >
          {rightText}
        </Text>,
      );
    }
    if (rightIconName) {
      rightElements.push(
        <Pressable mr="2" onPress={onPressRightIcon} key="rightIconName">
          <Icon
            size={20}
            name={rightIconName}
            color={isDisabled ? 'text-disabled' : 'text-subdued'}
          />
        </Pressable>,
      );
    }
    if (rightSecondaryText) {
      if (rightText) {
        rightElements.push(<Divider orientation="vertical" h="3" mr="2" />);
      }
      rightElements.push(
        <Text
          key="rightText"
          mr="2"
          fontSize={fontSize}
          onPress={onPressSecondaryRightText}
          fontWeight={600}
          color={isDisabled ? 'text-disabled' : 'text-default'}
        >
          {rightSecondaryText}
        </Text>,
      );
    }
    if (rightSecondaryIconName) {
      rightElements.push(
        <Pressable
          mr="2"
          onPress={onPressSecondaryRightIcon}
          key="rightSecondaryIconName"
        >
          <Icon
            size={20}
            name={rightSecondaryIconName}
            color={isDisabled ? 'text-disabled' : 'text-subdued'}
          />
        </Pressable>,
      );
    }
    return (
      <BaseInput
        ref={ref}
        isDisabled={isDisabled}
        InputLeftElement={leftElements}
        InputRightElement={rightElements}
        w="80"
        borderColor="border-default"
        bg="action-secondary-default"
        color={isDisabled ? 'text-disabled' : 'text-default'}
        borderRadius="12"
        py="2"
        px="2"
        _disabled={{
          bg: 'action-secondary-disabled',
          borderColor: 'border-disabled',
        }}
        _hover={{
          bg: 'action-secondary-default',
          borderColor: 'border-hovered',
        }}
        _focus={{
          bg: 'action-secondary-default',
          borderColor: 'focused-default',
        }}
        _invalid={{ borderColor: 'border-critical-default' }}
        placeholderTextColor={isDisabled ? 'text-disabled' : 'text-subdued'}
        {...textProps}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

export default Input;
