import React, { ComponentProps, FC, Fragment } from 'react';

import { TextArea as NativeBaseTextArea } from 'native-base';

import Box from '../Box';
import Button from '../Button';
import { ICON_NAMES } from '../Icon';
import { useIsVerticalLayout } from '../Provider/hooks';
import { Text, getTypographyStyleProps } from '../Typography';

type ConditionalWrapperProps = {
  condition?: boolean;
  wrapper: (children: JSX.Element) => JSX.Element;
  children: JSX.Element;
};

const ConditionalWrapper: FC<ConditionalWrapperProps> = ({
  condition,
  wrapper,
  children,
}) => (condition ? wrapper(children) : children);

type TextAreaProps = {
  isInvalid?: boolean;
  actions?: Array<{ icon?: ICON_NAMES; text?: string; onPress?: () => void }>;
};

const TextArea = React.forwardRef<
  typeof NativeBaseTextArea,
  ComponentProps<typeof NativeBaseTextArea> & TextAreaProps
>(({ isInvalid, actions, ...props }, ref) => {
  const small = useIsVerticalLayout();
  const textProps = small
    ? getTypographyStyleProps('Body1')
    : (getTypographyStyleProps('Body2') as Pick<
        ComponentProps<typeof Text>,
        'fontFamily' | 'fontWeight' | 'fontSize'
      >);
  return (
    <ConditionalWrapper
      condition={!!actions?.length}
      wrapper={(children) => (
        <Box>
          {children}
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
            {actions?.map((action, index) => (
              <Fragment key={index}>
                <Button
                  flex={1}
                  leftIconName={action.icon}
                  type="plain"
                  onPress={action.onPress}
                  ml={index > 0 ? 2 : undefined}
                >
                  {action.text}
                </Button>
              </Fragment>
            ))}
          </Box>
        </Box>
      )}
    >
      <>
        <NativeBaseTextArea
          ref={ref}
          selectionColor="text-default"
          isInvalid={isInvalid}
          borderColor="border-default"
          bg="action-secondary-default"
          borderRadius={12}
          borderBottomLeftRadius={actions?.length && 0}
          borderBottomRightRadius={actions?.length && 0}
          px="3"
          color="text-default"
          placeholderTextColor="text-disabled"
          fontFamily={textProps.fontFamily}
          fontWeight={textProps.fontWeight}
          fontSize={textProps.fontSize}
          _focus={{
            borderColor: isInvalid
              ? 'border-critical-default'
              : 'focused-default',
            bg: 'action-secondary-default',
            _hover: {
              borderColor: isInvalid
                ? 'border-critical-default'
                : 'focused-default',
            },
          }}
          _hover={{
            borderColor: isInvalid
              ? 'border-critical-default'
              : 'border-hovered',
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
          {...props}
        />
      </>
    </ConditionalWrapper>
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;
