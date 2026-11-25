import { Suspense, lazy, memo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';

// Lazy: the monitor only mounts with dev settings on, so it stays off the
// startup graph.
const WebPerformanceMonitor = lazy(() =>
  import('../../../components/WebPerformanceMonitor').then((m) => ({
    default: m.WebPerformanceMonitor,
  })),
);

const BasePerformanceMonitorContainer = () => {
  const [devSettings] = useDevSettingsPersistAtom();
  if (!devSettings.enabled) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <WebPerformanceMonitor />
    </Suspense>
  );
};

export const WebPerformanceMonitorContainer = memo(
  BasePerformanceMonitorContainer,
);
