import { useEffect, useRef } from 'react';

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

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      return;
    }
    if (isFocused) {
      void backgroundApiProxy.serviceNotification.registerClientDaily();
    }
  }, [isFocused]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    noop(locale, currencyInfo, hideValue);
    void backgroundApiProxy.serviceNotification.updateClientBasicAppInfo();
  }, [locale, currencyInfo, hideValue]);

  return <></>;
}
