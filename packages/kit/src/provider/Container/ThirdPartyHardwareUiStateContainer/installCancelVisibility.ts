import { useEffect, useState } from 'react';

export const INSTALL_CANCEL_STALL_DELAY = 30_000;

// Reveal cancel only when install progress stops advancing for `delayMs`.
// Caller passes a `progressKey` that mutates on every progress tick
// (e.g. `${appName}:${percent}`); each change re-runs the effect and resets
// the watchdog. The cleanup also fires when `installing` flips off or the
// host component unmounts (dialog closed), so the timer can never run after
// the dialog is gone and the late `setVisible` is guarded as well.
export function useInstallCancelOnStall({
  installing,
  progressKey,
  delayMs = INSTALL_CANCEL_STALL_DELAY,
}: {
  installing: boolean;
  progressKey: string;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    if (!installing) {
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      setVisible(true);
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [delayMs, installing, progressKey]);

  return visible;
}
