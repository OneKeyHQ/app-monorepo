/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import React, { FC, useCallback, useState } from 'react';

import { Box } from '@onekeyhq/components';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Setup from './Setup';
import { ValidationFields } from './types';
import Validation from './Validation';
import ValidationExt from './ValidationExt';

type SoftwareControlOptions = {
  isLocalAuthentication?: boolean;
  withEnableAuthentication?: boolean;
};

type SoftwareControlProps = {
  skipSavePassword?: boolean;
  field?: ValidationFields;
  render: (
    password: string,
    options: SoftwareControlOptions,
  ) => React.ReactNode;
};

export const SoftwareControl: FC<SoftwareControlProps> = ({
  render,
  skipSavePassword,
  field,
}) => {
  const [password, setPassword] = useState('');
  const [withEnableAuthentication, setWithEnableAuthentication] =
    useState<boolean>();
  const [isLocalAuthentication, setLocalAuthentication] = useState<boolean>();
  const isPasswordSet = useAppSelector((s) => s.data.isPasswordSet);
  const [hasPassword] = useState(isPasswordSet);

  const onValidationOk = useCallback((text: string, value?: boolean) => {
    setLocalAuthentication(value);
    setPassword(text);
  }, []);

  const onSetupOk = useCallback((text: string, value?: boolean) => {
    setWithEnableAuthentication(value);
    setPassword(text);
  }, []);

  if (password) {
    return (
      <Box w="full" h="full">
        {render(password, {
          withEnableAuthentication,
          isLocalAuthentication,
        })}
      </Box>
    );
  }

  if (hasPassword) {
    if (platformEnv.isExtension) {
      return <ValidationExt onOk={onValidationOk} field={field} />;
    }
    return <Validation onOk={onValidationOk} field={field} />;
  }
  return <Setup onOk={onSetupOk} skipSavePassword={skipSavePassword} />;
};
