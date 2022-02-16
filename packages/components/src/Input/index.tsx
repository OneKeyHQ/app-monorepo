import React, { ComponentProps, ReactNode } from 'react';

import { Input as BaseInput, Pressable, Stack } from 'native-base';

import Divider from '../Divider';
import HStack from '../HStack';
import Icon, { ICON_NAMES } from '../Icon';
import { useIsVerticalLayout } from '../Provider/hooks';
import { Text, getTypographyStyleProps } from '../Typography';

type Props = {
  isDisabled?: boolean;
  leftText?: string;
  rightText?: string;
  rightSecondaryText?: string;
  leftIconName?: ICON_NAMES;
  rightIconName?: ICON_NAMES;
  rightCustomElement?: ReactNode;
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
      rightCustomElement,
      ...props
    },
    ref,
  ) => {
    const leftElements: JSX.Element[] = [];
    const rightElements: JSX.Element[] = [];
    let pl = '3';
    let pr = '3';
    const small = useIsVerticalLayout();
    const textProps = small
      ? getTypographyStyleProps('Body1')
      : (getTypographyStyleProps('Body2') as Pick<
          ComponentProps<typeof Text>,
          'fontFamily' | 'fontWeight' | 'fontSize' | 'lineHeight'
        >);

    if (leftText) {
      leftElements.push(
        <Text
          typography={{ sm: 'Body1', md: 'Body2' }}
          key="leftText"
          color={isDisabled ? 'text-disabled' : 'text-subdued'}
          onPress={onPressLeftText}
        >
          {leftText}
        </Text>,
      );
    }
    if (leftIconName) {
      leftElements.push(
        <Pressable onPress={onPressLeftIcon} key="leftIconName">
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
          typography={{ sm: 'Body1', md: 'Body2' }}
          key="rightText"
          onPress={onPressRightText}
          color={isDisabled ? 'text-disabled' : 'text-subdued'}
        >
          {rightText}
        </Text>,
      );
    }
    if (rightIconName) {
      rightElements.push(
        <Pressable onPress={onPressRightIcon} key="rightIconName">
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
        rightElements.push(
          <Divider bg="border-subdued" orientation="vertical" h="3" />,
        );
      }
      rightElements.push(
        <Text
          typography={{ sm: 'Button1', md: 'Button2' }}
          key="rightSecondaryText"
          onPress={onPressSecondaryRightText}
          color={isDisabled ? 'text-disabled' : 'text-default'}
        >
          {rightSecondaryText}
        </Text>,
      );
    }
    if (rightCustomElement) {
      rightElements.push(
        <HStack alignItems="center" mr={-3}>
          {rightCustomElement}
        </HStack>,
      );
    }
    if (rightSecondaryIconName) {
      rightElements.push(
        <Pressable
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
    let inputLeftElement;
    let inputRightElement;
    if (leftElements.length > 0) {
      inputLeftElement = (
        <Stack space="2" ml="3" direction="row" alignItems="center">
          {leftElements}
        </Stack>
      );
      pl = '2';
    }
    if (rightElements.length > 0) {
      inputRightElement = (
        <Stack space="2" mr="3" direction="row" alignItems="center">
          {rightElements}
        </Stack>
      );
      pr = '2';
    }
    return (
      <BaseInput
        ref={ref}
        selectionColor="text-default"
        isDisabled={isDisabled}
        InputLeftElement={inputLeftElement}
        InputRightElement={inputRightElement}
        w="80"
        h={{ base: '42px', md: 'auto' }}
        borderColor="border-default"
        bg="action-secondary-default"
        color={isDisabled ? 'text-disabled' : 'text-default'}
        borderRadius="12"
        py="2"
        pl={pl}
        pr={pr}
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
        fontSize={textProps.fontSize}
        fontWeight={textProps.fontWeight}
        fontFamily={textProps.fontFamily}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

export default Input;
