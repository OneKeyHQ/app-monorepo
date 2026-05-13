import { Dialog, Toast } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SectionPressItem } from './SectionPressItem';

// Busy-loop the renderer JS thread for `durationMs` so the CPU watchdog,
// the long-task observer, and (if the user moves the mouse) Chromium's
// hung-renderer detector can all be exercised.
function burnCpuForMs(durationMs: number) {
  const deadline = Date.now() + durationMs;
  let spin = 0;
  while (Date.now() < deadline) {
    spin += 1;
  }
  return spin;
}

function confirmAndBurn(params: {
  title: string;
  description: string;
  durationMs: number;
}) {
  Dialog.confirm({
    title: params.title,
    description: params.description,
    confirmButtonProps: { variant: 'destructive' },
    onConfirm: () => {
      // Let the dialog close, then start the burn one tick later so the
      // tester can actually see the UI freeze rather than the dialog
      // appearing frozen mid-dismiss.
      setTimeout(() => {
        Toast.message({
          title: `Burning renderer CPU for ${Math.round(
            params.durationMs / 1000,
          )} s`,
        });
        setTimeout(() => {
          burnCpuForMs(params.durationMs);
        }, 100);
      }, 200);
    },
  });
}

export function CpuWatchdogDevSettings() {
  if (!platformEnv.isDesktop) {
    return null;
  }

  return [
    <SectionPressItem
      icon="PerformanceOutline"
      key="cpuWatchdog-burn-5s"
      title="CPU Watchdog: Burn 5 s (long-task observer)"
      subtitle="Fires a single 5 s long-task entry; no dialog expected."
      onPress={() =>
        confirmAndBurn({
          title: 'Burn renderer CPU for 5 s?',
          description:
            'The window will freeze for ~5 seconds. Used to verify the long-task observer + Sentry breadcrumb path. No watchdog dialog should appear.',
          durationMs: 5000,
        })
      }
    />,
    <SectionPressItem
      icon="PerformanceOutline"
      key="cpuWatchdog-burn-35s"
      title="CPU Watchdog: Burn 35 s (severe tier, 95% × 30 s)"
      subtitle="Window freezes ~35 s. Should trigger the severe-tier dialog around the 30 s mark."
      onPress={() =>
        confirmAndBurn({
          title: 'Burn renderer CPU for 35 s?',
          description:
            'The window will freeze for ~35 seconds and the severe-tier CPU watchdog dialog should appear. If you have used the dialog within the last 30 minutes, the cooldown will suppress it.',
          durationMs: 35_000,
        })
      }
    />,
    <SectionPressItem
      icon="PerformanceOutline"
      key="cpuWatchdog-burn-12s-unresponsive"
      title="CPU Watchdog: Burn 12 s (try Electron unresponsive)"
      subtitle="Move the mouse / click inside the window during the freeze — Chromium's hung-renderer monitor should fire 'unresponsive' and open the dialog."
      onPress={() =>
        confirmAndBurn({
          title: 'Burn renderer CPU for 12 s?',
          description:
            'The window will freeze for ~12 seconds. Interact with the window during the freeze to provoke the Electron unresponsive event. The severe-tier CPU watchdog will not fire (under the 30 s threshold).',
          durationMs: 12_000,
        })
      }
    />,
  ];
}
