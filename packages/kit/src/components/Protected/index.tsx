import React, { FC, useState } from 'react';

import { Box } from '@onekeyhq/components';

import { useStatus } from '../../hooks/redux';

import Setup from './Setup';
import Validation from './Validation';

type ProtectedProps = {
  children: (password: string) => React.ReactNode;
};

const Protected: FC<ProtectedProps> = ({ children }) => {
  const [value, setValue] = useState('');
  const { passwordCompleted } = useStatus();
  if (value) {
    return (
      <Box w="full" h="full">
        {children(value)}
      </Box>
    );
  }
  if (passwordCompleted) {
    return <Validation onOk={setValue} />;
  }
  return <Setup onOk={setValue} />;
};

export default Protected;
