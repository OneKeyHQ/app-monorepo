import React, {
  ComponentProps,
  ReactElement,
  ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { Input as BaseInput, Stack } from 'native-base';
import { Platform } from 'react-native';

import Box from '../Box';
import Divider from '../Divider';
import Icon, { ICON_NAMES } from '../Icon';
import Pressable from '../Pressable';
import { useIsVerticalLayout } from '../Provider/hooks';
import { Text, getTypographyStyleProps } from '../Typography';

import type { TypographyStyle } from '../Typography';

type Props = {
  autoFocus?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  leftText?: string;
  rightText?: string;
  rightSecondaryText?: string | ReactElement | null;
  leftIconName?: ICON_NAMES;
  rightIconName?: ICON_NAMES;
  rightCustomElement?: ReactNode;
  rightSecondaryIconName?: ICON_NAMES;
  size?: 'xl' | 'default' | string | undefined;
  textSize?: TypographyStyle;
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
      autoFocus,
      isDisabled,
      isReadOnly,
      leftText,
      rightText,
      leftIconName,
      rightCustomElement,
      rightIconName,
      rightSecondaryText,
      rightSecondaryIconName,
      size,
      textSize,
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
    const inputRef = useRef<typeof BaseInput>(null);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    useImperativeHandle(ref, () => inputRef.current!);
    useEffect(() => {
      if (autoFocus) {
        // ** focus immediately in Modal cause modal slow animation
        const timer = setTimeout(() => {
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          inputRef.current?.focus?.();
        }, 300);

        return () => {
          clearTimeout(timer);
        };
      }
    }, [autoFocus]);

    const leftElements: JSX.Element[] = [];
    const rightElements: JSX.Element[] = [];
    let pl = '3';
    let pr = '3';
    const small = useIsVerticalLayout();

    let textProps: Pick<
      ComponentProps<typeof Text>,
      'fontFamily' | 'fontWeight' | 'fontSize' | 'lineHeight'
    >;
    if (textSize) {
      textProps = getTypographyStyleProps(textSize);
    } else if (small || size === 'xl') {
      textProps = getTypographyStyleProps('Body1');
    } else {
      textProps = getTypographyStyleProps('Body2');
    }

    if (leftText) {
      leftElements.push(
        <Text
          typography={size === 'xl' ? 'Body1' : { sm: 'Body1', md: 'Body2' }}
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
          typography={size === 'xl' ? 'Body1' : { sm: 'Body1', md: 'Body2' }}
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
        <Pressable
          onPress={onPressRightIcon}
          key="rightIconName"
          pt={1}
          pb={1}
          pl={2}
        >
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
          <Divider
            key="rightDivider"
            bg="border-subdued"
            orientation="vertical"
            h="3"
          />,
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
        <Box
          flexDirection="row"
          alignItems="center"
          mr={-3}
          key="rightCustomElement"
        >
          {rightCustomElement}
        </Box>,
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
        ref={inputRef}
        selectionColor="text-default"
        isReadOnly={isReadOnly}
        isDisabled={isDisabled}
        InputLeftElement={inputLeftElement}
        InputRightElement={inputRightElement}
        w="80"
        minW="0"
        h={size === 'xl' ? '50px' : { base: '42px', md: 'auto' }}
        borderColor="border-default"
        bg="action-secondary-default"
        color={isDisabled ? 'text-disabled' : 'text-default'}
        borderRadius="12"
        py="2"
        pl={pl}
        pr={pr}
        // autoCompleteType="off"
        _disabled={{
          bg: 'action-secondary-disabled',
          borderColor: 'border-disabled',
          cursor: ['ios', 'android'].includes(Platform.OS)
            ? undefined
            : 'not-allowed',
        }}
        _ios={{
          selectionColor: 'interactive-default',
        }}
        _android={{
          selectionColor: 'interactive-default',
        }}
        _hover={{
          bg: 'action-secondary-default', // remove this will use the background color from default theme of NativeBase
          borderColor: 'border-hovered',
        }}
        _focus={{
          bg: 'action-secondary-default',
          borderColor: 'focused-default',
          _hover: {
            borderColor: 'focused-default',
          },
        }}
        _invalid={{ borderColor: 'border-critical-default' }}
        placeholderTextColor={isDisabled ? 'text-disabled' : 'text-subdued'}
        fontSize={textProps.fontSize}
        fontWeight={textProps.fontWeight}
        fontFamily={textProps.fontFamily}
        editable={!isReadOnly && !isDisabled}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';

export default Input;
