import { memo, useCallback, useState } from 'react';

import { Toast } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import BiologyAuthSwitchContainer from '../../BiologyAuthComponent/container/BiologyAuthSwitchContainer';
import PasswordSetup from '../components/PasswordSetup';

import type { IPasswordSetupForm } from '../components/PasswordSetup';

interface IPasswordSetupProps {
  onSetupRes: (password: string) => void;
}

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
            await backgroundApiProxy.servicePassword.encodeSensitivePassword(
              data.password,
            );
          const updatePasswordRes =
            await backgroundApiProxy.servicePassword.setPassword(
              encodePassword,
            );

          if (updatePasswordRes) {
            onSetupRes(updatePasswordRes);
            Toast.success({ title: 'password set success' });
          }
        } catch (e) {
          onSetupRes('');
          console.log('e', e);
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
      biologyAuthSwitchContainer={<BiologyAuthSwitchContainer />}
    />
  );
};

export default memo(PasswordSetupContainer);
