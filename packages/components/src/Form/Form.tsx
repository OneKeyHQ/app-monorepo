import React, { ComponentProps, FC } from 'react';

import KeyboardAwareScrollView from '../KeyboardAwareScrollView';
import VStack from '../VStack';

type FormProps = ComponentProps<typeof VStack>;

export const Form: FC<FormProps> = ({ children, ...props }) => (
  <KeyboardAwareScrollView w="full">
    <VStack space={6} w="full" {...props}>
      {children}
    </VStack>
  </KeyboardAwareScrollView>
);
