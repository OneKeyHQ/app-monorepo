import React, { ComponentProps } from 'react';

import { Box } from '@onekeyhq/components';

export enum SpeedindicatorColors {
  Fast = 'icon-success',
  Slow = 'icon-warning',
  Unavailable = 'icon-critical',
}

type Props = {
  backgroundColor: SpeedindicatorColors;
} & ComponentProps<typeof Box>;

const Speedindicator = (props: Props) => (
  <Box
    size="8px"
    borderRadius="full"
    borderWidth="2px"
    borderColor="action-secondary-default"
    {...props}
  />
);

export default Speedindicator;
