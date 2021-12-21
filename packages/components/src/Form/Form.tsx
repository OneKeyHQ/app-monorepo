import React, { FC } from 'react';

import { IBoxProps } from 'native-base';

import Box from '../Box';

// type FormProps = {};

export const Form: FC<IBoxProps> = ({ children, ...props }) => (
  <Box {...props}>{children}</Box>
);
