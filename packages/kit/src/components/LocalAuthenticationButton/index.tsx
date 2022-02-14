import React, { FC, useCallback } from 'react';

import { IconButton } from '@onekeyhq/components';

import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';

type LocalAuthenticationButtonProps = { onOk?: () => void };

const LocalAuthenticationButton: FC<LocalAuthenticationButtonProps> = ({
  onOk,
}) => {
  const { isOk, localAuthenticate } = useLocalAuthentication();
  const onPress = useCallback(async () => {
    const localAuthenticateResult = await localAuthenticate();
    if (localAuthenticateResult.success) {
      onOk?.();
    }
  }, [onOk, localAuthenticate]);
  return isOk ? (
    <IconButton iconSize={24} name="FaceIdOutline" onPress={onPress} />
  ) : null;
};

export default LocalAuthenticationButton;
