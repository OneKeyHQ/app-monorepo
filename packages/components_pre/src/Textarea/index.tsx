/* eslint-disable react/prop-types */
import type { ComponentProps } from 'react';
import { forwardRef, useCallback } from 'react';

import { TextArea as NativeBaseTextArea } from 'native-base';

import { useIsVerticalLayout } from '@onekeyhq/components';

import Box from '../Box';
import Button from '../Button';
import { getTypographyStyleProps } from '../Typography';

import type { ICON_NAMES } from '../Icon';
import type Text from '../Text';

export type TextAreaAction = {
  icon?: ICON_NAMES;
  text?: string;
  onPress?: () => void;
};
type TextAreaProps = {
  isInvalid?: boolean;
  actions?: Array<TextAreaAction>;
  trimValue?: boolean;
};

const TextArea = forwardRef<
  typeof NativeBaseTextArea,
  ComponentProps<typeof NativeBaseTextArea> & TextAreaProps
>(({ isInvalid, trimValue, actions = [], onChangeText, ...props }, ref) => {
  const small = useIsVerticalLayout();
  const textProps = small
    ? getTypographyStyleProps('Body1')
    : (getTypographyStyleProps('Body2') as Pick<
        ComponentProps<typeof Text>,
        'fontFamily' | 'fontWeight' | 'fontSize'
      >);

  const onChangeTrimText = useCallback(
    (v: string) => {
      onChangeText?.(trimValue ? v?.trim?.() : v);
    },
    [onChangeText, trimValue],
  );

  const primaryComponent = (
    <NativeBaseTextArea
      ref={ref}
      selectionColor="text-subdued"
      isInvalid={isInvalid}
      borderColor="border-default"
      bg="action-secondary-default"
      borderRadius={12}
      borderBottomLeftRadius={actions.length ? 0 : undefined}
      borderBottomRightRadius={actions.length ? 0 : undefined}
      px="3"
      color="text-default"
      placeholderTextColor="text-subdued"
      fontFamily={textProps.fontFamily}
      fontWeight={textProps.fontWeight}
      fontSize={textProps.fontSize}
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect={false}
      _focus={{
        borderColor: isInvalid ? 'border-critical-default' : 'focused-default',
        bg: 'action-secondary-default',
        _hover: {
          borderColor: isInvalid
            ? 'border-critical-default'
            : 'focused-default',
        },
      }}
      _hover={{
        borderColor: isInvalid ? 'border-critical-default' : 'border-hovered',
        bg: 'action-secondary-default',
      }}
      _disabled={{
        borderColor: 'border-disabled',
        bg: 'action-secondary-disabled',
      }}
      _invalid={{
        borderColor: 'border-critical-default',
      }}
      shadow="depth.1"
      onChangeText={onChangeTrimText}
      {...props}
    />
  );

  return actions.length ? (
    <Box>
      {primaryComponent}
      <Box
        flexDirection="row"
        justifyContent="center"
        p={2}
        borderWidth={1}
        borderColor="border-default"
        borderTopWidth={0}
        borderBottomLeftRadius={12}
        borderBottomRadius={12}
        bgColor="action-secondary-default"
      >
        {actions.map((action, index) => (
          <Button
            key={index}
            flex={1}
            leftIconName={action.icon}
            type="plain"
            onPress={action.onPress}
            ml={index > 0 ? 2 : undefined}
          >
            {action.text}
          </Button>
        ))}
      </Box>
    </Box>
  ) : (
    primaryComponent
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;
