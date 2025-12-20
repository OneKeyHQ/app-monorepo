import { memo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { WebPerformanceMonitor } from '../../../components/WebPerformanceMonitor';

const BasePerformanceMonitorContainer = () => {
  const [devSettings] = useDevSettingsPersistAtom();
  if (!devSettings.enabled) {
    return null;
  }
  return <WebPerformanceMonitor />;
};

export const WebPerformanceMonitorContainer = memo(
  BasePerformanceMonitorContainer,
);
