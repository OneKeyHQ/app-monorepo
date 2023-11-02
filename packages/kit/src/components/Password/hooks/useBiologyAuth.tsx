import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { useSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  hasHardwareSupported,
  localAuthenticate,
} from '../../../utils/localAuthentication';

const useBiologyAuth = () => {
  const [isSupportBiologyAuth, setIsSupportBiologyAuth] = useState(false);
  const intl = useIntl();
  // TODO get authenticationType supportedAuthenticationTypesAsync 获取支持的生物识别类型
  const [settings, setSettings] = useSettingsAtom();
  useEffect(() => {
    hasHardwareSupported()
      .then(setIsSupportBiologyAuth)
      .catch(() => {});
  }, []);

  const enableBiologyAuth = useMemo(
    () => isSupportBiologyAuth && settings.biologyAuthEnable,
    [isSupportBiologyAuth, settings.biologyAuthEnable],
  );

  const setBiologyAuthEnable = useCallback(
    async (enable: boolean) => {
      if (enable) {
        const localAuthenticateResult = await localAuthenticate();
        if (!localAuthenticateResult.success) {
          Toast.error({
            title: intl.formatMessage({ id: 'msg__verification_failure' }),
          });
          return;
        }
      }
      setSettings((prev) => ({ ...prev, biologyAuthEnable: enable }));
    },
    [intl, setSettings],
  );
  return { enableBiologyAuth, isSupportBiologyAuth, setBiologyAuthEnable };
};

export default useBiologyAuth;
