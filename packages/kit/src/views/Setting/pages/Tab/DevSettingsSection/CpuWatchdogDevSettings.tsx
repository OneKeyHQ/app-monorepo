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

function startLongTaskCapture():
  | { stop: () => { count: number; maxMs: number; totalMs: number } }
  | undefined {
  if (typeof globalThis.PerformanceObserver === 'undefined') return undefined;
  const captured: { duration: number }[] = [];
  try {
    const observer = new globalThis.PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        captured.push({ duration: e.duration });
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
    return {
      stop: () => {
        observer.disconnect();
        const totalMs = captured.reduce((s, e) => s + e.duration, 0);
        const maxMs = captured.reduce((m, e) => Math.max(m, e.duration), 0);
        return { count: captured.length, maxMs, totalMs };
      },
    };
  } catch {
    return undefined;
  }
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
          const capture = startLongTaskCapture();
          burnCpuForMs(params.durationMs);
          // Defer one tick so the PerformanceObserver callback can flush
          // the entries collected during the busy loop before we read them.
          setTimeout(() => {
            const stats = capture?.stop();
            if (stats) {
              Toast.success({
                title: `Burn complete — ${stats.count} long-task(s)`,
                message: `max=${Math.round(stats.maxMs)}ms  total=${Math.round(
                  stats.totalMs,
                )}ms. Logged via defaultLogger.app.perf.longTask.`,
              });
            } else {
              Toast.success({
                title: 'Burn complete',
                message:
                  'PerformanceObserver unavailable on this platform; only main-process watchdog can verify.',
              });
            }
          }, 50);
        }, 100);
      }, 200);
    },
  });
}

function forceTrigger(
  reason:
    | 'sustained-high-cpu-severe'
    | 'sustained-high-cpu-mild'
    | 'unresponsive',
) {
  const api = globalThis.desktopApi as
    | { forceCpuWatchdog?: (r: string) => void }
    | undefined;
  if (!api?.forceCpuWatchdog) {
    Toast.error({
      title: 'forceCpuWatchdog unavailable',
      message: 'preload may be out of date; rebuild the desktop bundle.',
    });
    return;
  }
  api.forceCpuWatchdog(reason);
  Toast.message({
    title: `Forced watchdog: ${reason}`,
  });
}

export function CpuWatchdogDevSettings() {
  if (!platformEnv.isDesktop) {
    return null;
  }

  return [
    <SectionPressItem
      icon="PerformanceOutline"
      key="cpuWatchdog-force-severe"
      title="CPU Watchdog: Force Severe Dialog"
      subtitle="Opens the watchdog dialog immediately (bypasses 30 s × 95% threshold and 30 min cooldown). Use to verify dialog UX + button paths without freezing the UI."
      onPress={() => forceTrigger('sustained-high-cpu-severe')}
    />,
    <SectionPressItem
      icon="PerformanceOutline"
      key="cpuWatchdog-force-mild"
      title="CPU Watchdog: Force Mild Dialog"
      subtitle="Same as above but with reason=sustained-high-cpu-mild (text shows 80% × 5 min)."
      onPress={() => forceTrigger('sustained-high-cpu-mild')}
    />,
    <SectionPressItem
      icon="PerformanceOutline"
      key="cpuWatchdog-force-unresponsive"
      title="CPU Watchdog: Force Unresponsive Dialog"
      subtitle="Same as above but with reason=unresponsive (text shows 'window is not responding')."
      onPress={() => forceTrigger('unresponsive')}
    />,
    <SectionPressItem
      icon="PerformanceOutline"
      key="cpuWatchdog-burn-5s"
      title="CPU Watchdog: Burn 5 s (long-task observer)"
      subtitle="Fires a single ~5 s long-task entry; no watchdog dialog expected. A Toast reports the captured duration."
      onPress={() =>
        confirmAndBurn({
          title: 'Burn renderer CPU for 5 s?',
          description:
            'The window will freeze for ~5 seconds. Used to verify the long-task observer + Sentry breadcrumb path. No watchdog dialog should appear — a Toast will confirm the captured long-task entry.',
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
