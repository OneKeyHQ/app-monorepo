import React, { FC, ComponentProps } from 'react';
import { Divider as NBDivider } from 'native-base';

const Divider: FC<ComponentProps<typeof NBDivider>> = (props) => (
  <NBDivider bg="border-subdued" {...props} />
);

export default Divider;
