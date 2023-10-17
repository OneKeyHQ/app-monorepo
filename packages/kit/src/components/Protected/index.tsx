/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { FC, ReactNode } from 'react';
import { memo, useCallback, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import Session from './Session';
import Setup from './Setup';
import { ValidationFields } from './types';

type ProtectedOptions = {
  isLocalAuthentication?: boolean;
  withEnableAuthentication?: boolean;
  deviceFeatures?: IOneKeyDeviceFeatures;
};

type ProtectedProps = {
  skipSavePassword?: boolean;
  /** walletId for current flow, null means createWallet flow */
  // walletId: string | null;
  children: (password: string, options: ProtectedOptions) => ReactNode;
  hideTitle?: boolean;
  isAutoHeight?: boolean;
  placeCenter?: boolean;
  title?: string;
  subTitle?: string;
  // networkId?: string;
  // checkIsNeedPassword?: () => Promise<boolean>;
};

// Protected
const Protected: FC<ProtectedProps> = ({
  children,
  skipSavePassword,

  // walletId,
  hideTitle,
  placeCenter,
  title,
  subTitle,
  // networkId,
  // checkIsNeedPassword,
}) => {
  const [password, setPassword] = useState('');
  const [withEnableAuthentication, setWithEnableAuthentication] =
    useState<boolean>();
  const [isLocalAuthentication, setLocalAuthentication] = useState<boolean>();
  // const { isPasswordSet } = useData();
  const [hasPassword] = useState(true);

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
      <Stack w="full" h="full">
        {children(password, {
          withEnableAuthentication,
          isLocalAuthentication,
        })}
      </Stack>
    );
  }

  // input password
  if (hasPassword) {
    return (
      <Session
        onOk={onValidationOk}
        hideTitle={hideTitle}
        placeCenter={placeCenter}
        title={title}
        subTitle={subTitle}
      />
    );
  }
  // create new password
  return (
    <Setup
      onOk={onSetupOk}
      skipSavePassword={skipSavePassword}
      hideTitle={hideTitle}
    />
  );
};

export default memo(Protected);
export { ValidationFields };
