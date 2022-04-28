import React, { FC, useCallback, useState } from 'react';

import { Box } from '@onekeyhq/components';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import { useData } from '../../hooks/redux';

import Setup from './Setup';
import { ValidationFields } from './types';
import Validation from './Validation';

type ProtectedOptions = {
  isLocalAuthentication?: boolean;
  withEnableAuthentication?: boolean;
};

type ProtectedProps = {
  skipSavePassword?: boolean;
  field?: ValidationFields;
  children: (password: string, options: ProtectedOptions) => React.ReactNode;
};

const Protected: FC<ProtectedProps> = ({
  children,
  skipSavePassword,
  field,
}) => {
  const [password, setPassword] = useState('');
  const [withEnableAuthentication, setWithEnableAuthentication] =
    useState<boolean>();
  const [isLocalAuthentication, setLocalAuthentication] = useState<boolean>();
  const { isPasswordSet } = useData();
  const [hasPassword] = useState(isPasswordSet);

  const onValidationOk = useCallback((text: string, value?: boolean) => {
    setLocalAuthentication(value);
    setPassword(text);
  }, []);

  const onSetupOk = useCallback((text: string, value?: boolean) => {
    setWithEnableAuthentication(value);
    setPassword(text);
  }, []);

  const { wallet } = useActiveWalletAccount();
  const isHardware = wallet?.type === 'hw';

  if (password || isHardware) {
    return (
      <Box w="full" h="full">
        {children(password, {
          withEnableAuthentication,
          isLocalAuthentication,
        })}
      </Box>
    );
  }
  if (hasPassword) {
    return <Validation onOk={onValidationOk} field={field} />;
  }
  return <Setup onOk={onSetupOk} skipSavePassword={skipSavePassword} />;
};

export default Protected;
export { ValidationFields };
