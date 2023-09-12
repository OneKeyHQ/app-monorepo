/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { FC, ReactNode } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';

import { Box } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useData } from '@onekeyhq/kit/src/hooks/redux';

import Session from './Session';
import Setup from './Setup';
import { ValidationFields } from './types';

type ProtectedOptions = {
  isLocalAuthentication?: boolean;
  withEnableAuthentication?: boolean;
};

export interface ProtectedBaseProps {
  hideTitle?: boolean;
  isAutoHeight?: boolean;
  placeCenter?: boolean;
  title?: string;
  subTitle?: string;
  skipSavePassword?: boolean;
}

export interface ProtectedProps extends ProtectedBaseProps {
  children: (password: string, options: ProtectedOptions) => ReactNode;
}

// Protected
const Protected: FC<ProtectedProps> = ({
  children,
  skipSavePassword,
  hideTitle,
  isAutoHeight,
  placeCenter,
  title,
  subTitle,
}) => {
  const { serviceApp } = backgroundApiProxy;

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

  useEffect(() => {
    const timer = setTimeout(() => {
      serviceApp.checkUpdateStatus();
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useEffect(() => {
  //   if (network?.settings.validationRequired && !isPasswordLoadedInVault) {
  //     setPassword('');
  //   }
  // }, [isPasswordLoadedInVault, network]);

  // useEffect(() => {
  //   if (checkIsNeedPassword) {
  //     checkIsNeedPassword().then((value) => {
  //       setIsNeedInputPassword(value);
  //     });
  //   }
  // }, [checkIsNeedPassword]);

  // if (isExternalWallet) {
  //   console.log('1');
  //   return (
  //     <Box flex={1}>
  //       {children(password, {
  //         withEnableAuthentication,
  //         isLocalAuthentication,
  //       })}
  //     </Box>
  //   );
  // }

  if (password) {
    return (
      <Box w="full" h="full">
        {children(password, {
          withEnableAuthentication,
          isLocalAuthentication,
        })}
      </Box>
    );
  }

  // input password
  if (hasPassword) {
    console.log('6');
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
  console.log('7');
  // create new password
  return (
    <Setup
      onOk={onSetupOk}
      skipSavePassword={skipSavePassword}
      hideTitle={hideTitle}
      isAutoHeight={isAutoHeight}
    />
  );
};

export default memo(Protected);
export { ValidationFields };
