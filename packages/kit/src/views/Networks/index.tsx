import React, { FC } from 'react';

import { Button, Center } from '@onekeyhq/components';

import NetworksModal from './NetworksModal';

const Networks: FC = () => (
  <Center flex="1">
    <NetworksModal trigger={<Button type="primary">Networks</Button>} />
  </Center>
);

export default Networks;
