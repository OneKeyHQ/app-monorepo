import type { ComponentProps, FC } from 'react';

import { Divider as NBDivider } from 'native-base';

const Divider: FC<ComponentProps<typeof NBDivider>> = (props) => (
  <NBDivider bg="divider" {...props} />
);

export default Divider;
