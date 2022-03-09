import React, { FC, useCallback, useState } from 'react';

import { Box } from '@onekeyhq/components';

import { useStatus } from '../../hooks/redux';

import Setup from './Setup';
import Validation from './Validation';

type ProtectedProps = {
  children: (
    password: string,
    isLocalAuthentication?: boolean,
  ) => React.ReactNode;
};

const Protected: FC<ProtectedProps> = ({ children }) => {
  const [password, setPassword] = useState('');
  const [isLocalAuthentication, setLocalAuthentication] = useState<boolean>();
  const { passwordCompleted } = useStatus();
  const [hasPassword] = useState(passwordCompleted);

  const onOk = useCallback((text: string, is?: boolean) => {
    setLocalAuthentication(is);
    setPassword(text);
  }, []);
  if (password) {
    return (
      <Box w="full" h="full">
        {children(password, isLocalAuthentication)}
      </Box>
    );
  }
  if (hasPassword) {
    return <Validation onOk={onOk} />;
  }
  return <Setup onOk={onOk} />;
};

export default Protected;
