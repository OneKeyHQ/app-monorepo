import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePasswordBiologyAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import BiologyAuthSwitch from '../components/BiologyAuthSwitch';

interface IBiologyAuthSwitchContainerProps {
  skipAuth?: boolean; // only use for password setup
}

const BiologyAuthSwitchContainer = ({
  skipAuth,
}: IBiologyAuthSwitchContainerProps) => {
  const intl = useIntl();
  const [{ isSupport }] = usePasswordBiologyAuthInfoAtom();
  const [settings] = useSettingsPersistAtom();
  const onChange = useCallback(
    async (checked: boolean) => {
      try {
        await backgroundApiProxy.servicePassword.setBiologyAuthEnable(
          checked,
          skipAuth,
        );
      } catch (e) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_touch_id_set_error,
          }),
        });
      }
    },
    [intl, skipAuth],
  );
  return (
    <BiologyAuthSwitch
      isSupport={isSupport}
      isBiologyAuthEnable={settings.isBiologyAuthSwitchOn}
      onChange={onChange}
    />
  );
};
export default BiologyAuthSwitchContainer;
