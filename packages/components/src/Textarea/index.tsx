import React, { ComponentProps } from 'react';

import { TextArea as NativeBaseTextArea } from 'native-base';

type TextAreaProps = { isInvalid?: boolean };

const TextArea = React.forwardRef<
  typeof NativeBaseTextArea,
  ComponentProps<typeof NativeBaseTextArea> & TextAreaProps
>(({ isInvalid, ...props }, ref) => (
  <NativeBaseTextArea
    ref={ref}
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
));

TextArea.displayName = 'TextArea';

export default TextArea;
