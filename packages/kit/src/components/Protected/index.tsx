import React, { FC, useCallback, useState } from 'react';

import { Box } from '@onekeyhq/components';

import { useData } from '../../hooks/redux';

import Setup from './Setup';
import Validation from './Validation';

type ProtectedProps = {
  skipSavePassword?: boolean;
  children: (
    password: string,
    isLocalAuthentication?: boolean,
  ) => React.ReactNode;
};

const Protected: FC<ProtectedProps> = ({ children, skipSavePassword }) => {
  const [password, setPassword] = useState('');
  const [isLocalAuthentication, setLocalAuthentication] = useState<boolean>();
  const { isPasswordSet } = useData();
  const [hasPassword] = useState(isPasswordSet);

  const onOk = useCallback((text: string, value?: boolean) => {
    setLocalAuthentication(value);
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
  return <Setup onOk={onOk} skipSavePassword={skipSavePassword} />;
};

export default Protected;
