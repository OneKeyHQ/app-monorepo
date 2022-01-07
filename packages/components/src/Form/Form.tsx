import React, { FC } from 'react';

import { IBoxProps } from 'native-base';

import VStack from '../VStack';

// type FormProps = {};

export const Form: FC<IBoxProps> = ({ children, ...props }) => (
  <VStack space={6} w="full" {...props}>
    {children}
  </VStack>
);
