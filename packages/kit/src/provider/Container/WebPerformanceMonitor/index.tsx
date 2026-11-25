import type { PropsWithChildren } from 'react';
import { Component, memo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

// Lazy: the monitor only mounts when a developer turns it on, so it stays off
// the startup graph. LazyLoad retries a transient chunk failure, and a later
// mount imports afresh.
const WebPerformanceMonitor = LazyLoad<Record<string, unknown>>(() =>
  import('../../../components/WebPerformanceMonitor').then((m) => ({
    default: m.WebPerformanceMonitor,
  })),
);

// A monitor chunk that still fails to load drops the monitor, not the wallet.
class MonitorLoadBoundary extends Component<
  PropsWithChildren,
  { failed: boolean }
> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    const { failed } = this.state;
    const { children } = this.props;
    return failed ? null : children;
  }
}

const BasePerformanceMonitorContainer = () => {
  const [devSettings] = useDevSettingsPersistAtom();
  if (!devSettings.enabled || !devSettings.settings?.showPerformanceMonitorV2) {
    return null;
  }
  return (
    <MonitorLoadBoundary>
      <WebPerformanceMonitor />
    </MonitorLoadBoundary>
  );
};

export const WebPerformanceMonitorContainer = memo(
  BasePerformanceMonitorContainer,
);
