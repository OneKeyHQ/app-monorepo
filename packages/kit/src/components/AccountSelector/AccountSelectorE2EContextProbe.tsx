import { useEffect, useRef } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector/atoms';

import { registerAccountSelectorMountedContext } from './AccountSelectorMirrorInspectorObserver';

import type { IAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector/atoms';
import type { IJotaiContextStore } from '../../states/jotai/utils/createJotaiContext';

let nextAccountSelectorMountedContextInstanceId = 0;

export type IAccountSelectorE2EContextProbeProps = {
  enabledNum: number[];
  expectedConfig: IAccountSelectorContextData;
  expectedStore: IJotaiContextStore;
  perfDebugName?: string;
  probeName: string;
};

export function AccountSelectorE2EContextProbe({
  enabledNum,
  expectedConfig,
  expectedStore,
  perfDebugName,
  probeName,
}: IAccountSelectorE2EContextProbeProps) {
  const { config: actualConfig, store: actualStore } =
    useAccountSelectorContextData();
  const instanceIdRef = useRef<number | undefined>(undefined);
  if (instanceIdRef.current === undefined) {
    nextAccountSelectorMountedContextInstanceId += 1;
    instanceIdRef.current = nextAccountSelectorMountedContextInstanceId;
  }
  const instanceId = instanceIdRef.current;

  useEffect(() => {
    if (!actualConfig || !actualStore) return undefined;
    return registerAccountSelectorMountedContext({
      actualConfig,
      actualStore,
      enabledNum,
      expectedConfig,
      expectedStore,
      instanceId,
      perfDebugName,
      probeName,
    });
  }, [
    actualConfig,
    actualStore,
    enabledNum,
    expectedConfig,
    expectedStore,
    instanceId,
    perfDebugName,
    probeName,
  ]);

  return null;
}

function AccountSelectorE2EContextProbeDevSettingsGate(
  props: IAccountSelectorE2EContextProbeProps,
) {
  const [devSettings] = useDevSettingsPersistAtom();
  const isInspectorEnabled = Boolean(
    devSettings.enabled &&
    devSettings.settings?.showAccountSelectorMirrorInspector,
  );

  if (!isInspectorEnabled) return null;
  return <AccountSelectorE2EContextProbe {...props} />;
}

export default function AccountSelectorE2EContextProbeSettingGate(
  props: IAccountSelectorE2EContextProbeProps,
) {
  if (platformEnv.isE2E) {
    return <AccountSelectorE2EContextProbe {...props} />;
  }
  return <AccountSelectorE2EContextProbeDevSettingsGate {...props} />;
}
