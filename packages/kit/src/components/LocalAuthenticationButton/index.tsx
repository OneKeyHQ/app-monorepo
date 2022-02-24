import React, { FC, useCallback } from 'react';

import { IconButton } from '@onekeyhq/components';

import { useSettings } from '../../hooks/redux';
import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';

type LocalAuthenticationButtonProps = { onOk?: (password: string) => void };

const LocalAuthenticationButton: FC<LocalAuthenticationButtonProps> = ({
  onOk,
}) => {
  const { isOk, localAuthenticate, getPassword } = useLocalAuthentication();
  const { enableLocalAuthentication } = useSettings();
  const onPress = useCallback(async () => {
    const localAuthenticateResult = await localAuthenticate();
    if (localAuthenticateResult.success) {
      const password = await getPassword();
      if (password) {
        onOk?.(password);
      }
    }
  }, [onOk, localAuthenticate, getPassword]);
  return isOk && enableLocalAuthentication ? (
    <IconButton iconSize={24} name="FaceIdOutline" onPress={onPress} />
  ) : null;
};

export default LocalAuthenticationButton;
