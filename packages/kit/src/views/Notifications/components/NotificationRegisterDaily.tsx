import { useEffect } from 'react';

import { noop } from 'lodash';

import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';

export function NotificationRegisterDaily() {
  const isFocused = useRouteIsFocused();
  const [{ locale, currencyInfo }] = useSettingsPersistAtom();
  const [{ hideValue }] = useSettingsValuePersistAtom();

  useEffect(() => {
    if (isFocused) {
      void backgroundApiProxy.serviceNotification.registerClientDaily();
    }
  }, [isFocused]);

  useEffect(() => {
    noop(locale, currencyInfo, hideValue);
    void backgroundApiProxy.serviceNotification.registerClientWithAppendAccounts(
      {
        dbAccounts: [],
      },
    );
  }, [locale, currencyInfo, hideValue]);

  return <></>;
}
