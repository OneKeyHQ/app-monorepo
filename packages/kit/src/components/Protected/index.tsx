import React, { FC } from 'react';

import { useWallet } from '@onekeyhq/kit/src/hooks/redux';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { HardwareControl } from './HardwareControl';
import { SoftwareControl } from './SoftwareControl';
import { ValidationFields } from './types';

type ProtectedOptions = {
  isLocalAuthentication?: boolean;
  withEnableAuthentication?: boolean;
  deviceFeatures?: IOneKeyDeviceFeatures;
};

type ProtectedProps = {
  skipSavePassword?: boolean;
  /** walletId for current flow, null means createWallet flow */
  walletId: string | null;
  field?: ValidationFields;
  children: (password: string, options: ProtectedOptions) => React.ReactNode;
};

const Protected: FC<ProtectedProps> = ({
  children,
  skipSavePassword,
  field,
  walletId,
}) => {
  const wallet = useWallet(walletId);
  const isHardware = wallet?.type === 'hw';
  if (isHardware) {
    return (
      <HardwareControl walletDetail={wallet}>
        {children('', {})}
      </HardwareControl>
    );
  }
  return (
    <SoftwareControl
      skipSavePassword={skipSavePassword}
      render={children}
      field={field}
    />
  );
};

export default Protected;
export { ValidationFields };
