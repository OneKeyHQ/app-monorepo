import { useEffect, useState } from 'react';

export const INSTALL_CANCEL_DELAY = 30_000;

// Reveal cancel when install progress stops advancing for `delayMs`.
// Caller mutates `progressKey` on every progress tick so each change resets
// the watchdog; cleanup also fires on `installing` flip or unmount.
export function useInstallCancelVisibility({
  installing,
  progressKey,
  delayMs = INSTALL_CANCEL_DELAY,
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
