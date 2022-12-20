import type { ComponentProps, FC } from 'react';

import VStack from '../VStack';

type FormProps = ComponentProps<typeof VStack>;

export const Form: FC<FormProps> = ({ children, ...props }) => (
  <VStack space={6} w="full" {...props}>
    {children}
  </VStack>
);
