import { memo, useCallback } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IAccountSelectorMirrorInspectorProps } from '../../../components/AccountSelector/AccountSelectorMirrorInspector';

const AccountSelectorMirrorInspector =
  LazyLoad<IAccountSelectorMirrorInspectorProps>(
    () =>
      import('../../../components/AccountSelector/AccountSelectorMirrorInspector'),
  );

function AccountSelectorMirrorInspectorSettingGate() {
  const [devSettings, setDevSettings] = useDevSettingsPersistAtom();
  const isEnabled = Boolean(
    devSettings.enabled &&
    devSettings.settings?.showAccountSelectorMirrorInspector,
  );
  const handleClose = useCallback(() => {
    setDevSettings((current) => ({
      ...current,
      settings: {
        ...current.settings,
        showAccountSelectorMirrorInspector: false,
      },
    }));
  }, [setDevSettings]);

  if (!isEnabled) return null;
  return <AccountSelectorMirrorInspector onClose={handleClose} />;
}

function BasicAccountSelectorMirrorInspectorContainer() {
  if (
    process.env.NODE_ENV === 'production' ||
    !platformEnv.isWeb ||
    (!platformEnv.isDev && !platformEnv.isE2E) ||
    !globalThis.document?.body
  ) {
    return null;
  }

  return <AccountSelectorMirrorInspectorSettingGate />;
}

export const AccountSelectorMirrorInspectorContainer = memo(
  BasicAccountSelectorMirrorInspectorContainer,
);
