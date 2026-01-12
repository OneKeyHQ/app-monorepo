import { useEffect, useRef } from 'react';

import { debounce, noop } from 'lodash';

import { useDeepCompareEffect } from '@onekeyhq/components';
import {
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useKeylessWallet,
  useVerifyKeylessPinChecking,
} from '../../../components/KeylessWallet/useKeylessWallet';
import { useRouteIsFocused } from '../../../hooks/useRouteIsFocused';

const fn = debounce(
  async () => {
    void backgroundApiProxy.serviceNotification.registerClientDaily();
    void backgroundApiProxy.serviceDBBackup.backupDatabaseDaily();
    void backgroundApiProxy.serviceAccount.generateAllQrWalletsMissingXfp();
  },
  5000,
  {
    leading: false,
    trailing: true,
  },
);

const fn2 = debounce(
  async ({
    verifyKeylessPinChecking,
  }: {
    verifyKeylessPinChecking: () => Promise<void>;
  }) => {
    void verifyKeylessPinChecking();
  },
  timerUtils.getTimeDurationMs({ seconds: 10 }),
  {
    leading: true,
    trailing: false,
  },
);

export function NotificationRegisterDaily() {
  const isFocused = useRouteIsFocused();
  const [{ locale, currencyInfo }] = useSettingsPersistAtom();
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const { verifyKeylessPinChecking } = useVerifyKeylessPinChecking();

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      return;
    }
    if (isFocused) {
      void fn();
      void fn2({ verifyKeylessPinChecking });
    }
  }, [isFocused, verifyKeylessPinChecking]);

  useDeepCompareEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    noop(locale, currencyInfo, hideValue);
    console.log('NotificationRegisterDaily:', locale, currencyInfo, hideValue);
    void backgroundApiProxy.serviceNotification.updateClientBasicAppInfo();
  }, [locale, currencyInfo, hideValue]);

  return <></>;
}
