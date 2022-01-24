import React, { ComponentProps, FC } from 'react';

import KeyboardAwareScrollView from '../KeyboardAwareScrollView';
import VStack from '../VStack';

type FormProps = ComponentProps<typeof VStack> & {
  keyboardAwareScrollViewProps?: ComponentProps<typeof KeyboardAwareScrollView>;
};

export const Form: FC<FormProps> = ({
  children,
  keyboardAwareScrollViewProps,
  ...props
}) => (
  <KeyboardAwareScrollView w="full" {...keyboardAwareScrollViewProps}>
    <VStack space={6} w="full" {...props}>
      {children}
    </VStack>
  </KeyboardAwareScrollView>
);
