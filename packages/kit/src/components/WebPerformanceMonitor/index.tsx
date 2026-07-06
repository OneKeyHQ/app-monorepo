import { memo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

import { MonitorContainer } from './MonitorContainer';

const BasePerformanceMonitor = () => {
  const [settings] = useDevSettingsPersistAtom();

  if (!settings.enabled || !settings.settings?.showPerformanceMonitorV2) {
    return null;
  }

  return <MonitorContainer />;
};

export const WebPerformanceMonitor = memo(BasePerformanceMonitor);
