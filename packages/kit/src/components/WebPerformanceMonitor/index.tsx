import { Suspense, lazy, memo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

const MonitorContainer = lazy(() =>
  import('./MonitorContainer').then((module) => ({
    default: module.MonitorContainer,
  })),
);

const BasePerformanceMonitor = () => {
  const [settings] = useDevSettingsPersistAtom();

  if (!settings.enabled || !settings.settings?.showPerformanceMonitorV2) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <MonitorContainer />
    </Suspense>
  );
};

export const WebPerformanceMonitor = memo(BasePerformanceMonitor);
