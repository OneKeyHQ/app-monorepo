import React, { FC, ComponentProps } from 'react';
import { TextArea as NativeBaseTextArea } from 'native-base';

// type TextAreaProps = {};

const TextArea: FC<ComponentProps<typeof NativeBaseTextArea>> = ({
  isInvalid,
  ...props
}) => (
  <NativeBaseTextArea
    isInvalid={isInvalid}
    borderColor="border-default"
    bg="action-secondary-default"
    color="text-default"
    _focus={{
      borderColor: isInvalid ? 'border-critical-default' : 'focused-default',
      bg: 'action-secondary-default',
    }}
    _hover={{
      borderColor: isInvalid ? 'border-critical-default' : 'focused-default',
      bg: 'action-secondary-default',
    }}
    _disabled={{
      borderColor: 'border-disabled',
      bg: 'action-secondary-disabled',
    }}
    _invalid={{
      borderColor: 'border-critical-default',
    }}
    {...props}
  />
);

export default TextArea;
