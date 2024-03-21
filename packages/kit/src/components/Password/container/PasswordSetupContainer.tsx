import { Suspense, memo, useCallback, useMemo, useState } from 'react';

import { AuthenticationType } from 'expo-local-authentication';
import { useIntl } from 'react-intl';

import { SizableText, Stack, Toast, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import { UniversalContainerWithSuspense } from '../../BiologyAuthComponent/container/UniversalContainer';
import PasswordSetup from '../components/PasswordSetup';

import type { IPasswordSetupForm } from '../components/PasswordSetup';

interface IPasswordSetupProps {
  onSetupRes: (password: string) => void;
}

const BiologyAuthContainer = () => {
  const [{ isSupport: biologyAuthIsSupport, authType }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isSupport: webAuthIsSupport }] = usePasswordWebAuthInfoAtom();
  const intl = useIntl();
  const settingsTitle = useMemo(() => {
    if (
      biologyAuthIsSupport &&
      authType.includes(AuthenticationType.FACIAL_RECOGNITION)
    ) {
      return intl.formatMessage(
        { id: 'content__authentication_with' },
        { 0: 'FaceID' },
      );
    }
    return intl.formatMessage(
      { id: 'content__authentication_with' },
      { 0: 'TouchID' },
    );
  }, [authType, biologyAuthIsSupport, intl]);
  return biologyAuthIsSupport || webAuthIsSupport ? (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMdMedium">{settingsTitle}</SizableText>
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
          Toast.success({ title: 'Password Set' });
        } catch (e) {
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
