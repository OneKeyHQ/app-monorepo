import { memo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { PerformanceMonitor } from '../../../components/PerformanceMonitor';

const BasePerformanceMonitorContainer = () => {
  const [devSettings] = useDevSettingsPersistAtom();
  if (!devSettings.enabled) {
    return null;
  }
  return <PerformanceMonitor />;
};

export const PerformanceMonitorContainer = memo(
  BasePerformanceMonitorContainer,
);
