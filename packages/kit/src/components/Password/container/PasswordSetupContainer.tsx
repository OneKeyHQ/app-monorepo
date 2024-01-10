import { Suspense, memo, useCallback, useState } from 'react';

import { SizableText, Stack, Toast, XStack } from '@onekeyhq/components';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { UniversalContainerWithSuspense } from '../../BiologyAuthComponent/container/UniversalContainer';
import PasswordSetup from '../components/PasswordSetup';

import type { IPasswordSetupForm } from '../components/PasswordSetup';

interface IPasswordSetupProps {
  onSetupRes: (password: string) => void;
}

const BiologyAuthContainer = () => {
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  return biologyAuthIsSupport || webAuthIsSupport ? (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMdMedium">Authentication with FaceID</SizableText>
      <Stack>
        <UniversalContainerWithSuspense />
      </Stack>
    </XStack>
  ) : null;
};

const PasswordSetupContainer = ({ onSetupRes }: IPasswordSetupProps) => {
  const [loading, setLoading] = useState(false);
  const onSetupPassword = useCallback(
    async (data: IPasswordSetupForm) => {
      if (data.confirmPassword !== data.password) {
        Toast.error({ title: 'password not match' });
      } else {
        setLoading(true);
        try {
          const encodePassword =
            await backgroundApiProxy.servicePassword.encodeSensitiveText({
              text: data.password,
            });

          const setUpPasswordRes =
            await backgroundApiProxy.servicePassword.setPassword(
              encodePassword,
            );
          onSetupRes(setUpPasswordRes);
          Toast.success({ title: 'password set success' });
        } catch (e) {
          console.log('e', e);
          console.log('e.stack', (e as Error)?.stack);
          console.error(e);
          Toast.error({ title: 'password set failed' });
        } finally {
          setLoading(false);
        }
      }
    },
    [onSetupRes],
  );

  return (
    <PasswordSetup
      loading={loading}
      onSetupPassword={onSetupPassword}
      biologyAuthSwitchContainer={
        <Suspense>
          <BiologyAuthContainer />
        </Suspense>
      }
    />
  );
};

export default memo(PasswordSetupContainer);
