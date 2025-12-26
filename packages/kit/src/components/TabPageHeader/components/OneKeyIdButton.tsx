import { useCallback } from 'react';

import { HeaderIconButton } from '@onekeyhq/components';

import { useOneKeyAuth } from '../../OneKeyAuth/useOneKeyAuth';

export interface IOneKeyIdButtonProps {
  testID?: string;
}

export function OneKeyIdButton({
  testID = 'onekey-id-button',
}: IOneKeyIdButtonProps = {}) {
  const { loginOneKeyId } = useOneKeyAuth();

  const handlePress = useCallback(async () => {
    await loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: true });
  }, [loginOneKeyId]);

  return (
    <HeaderIconButton
      key="onekey-id"
      title="OneKey ID"
      icon="PeopleOutline"
      onPress={handlePress}
      testID={testID}
    />
  );
}
