import { useEffect, useState } from 'react';

export const INSTALL_CANCEL_DELAY = 30_000;

export function useInstallCancelVisibility({
  installing,
  taskKey,
  delayMs = INSTALL_CANCEL_DELAY,
}: {
  installing: boolean;
  taskKey: string;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    if (!installing) {
      return undefined;
    }

    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, installing, taskKey]);

  return visible;
}
