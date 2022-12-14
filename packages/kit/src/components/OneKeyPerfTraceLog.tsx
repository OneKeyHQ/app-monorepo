import { useCallback } from 'react';

const onceLogCache: Record<string, boolean> = {};
export function OneKeyPerfTraceLog({
  name,
  once = true,
}: {
  name: string;
  once?: boolean;
}) {
  const doLog = useCallback(() => {
    global.$$onekeyPerfTrace?.log({
      name,
    });
  }, [name]);
  if (name) {
    if (once && !onceLogCache[name]) {
      doLog();
      onceLogCache[name] = true;
    }
    if (!once) {
      doLog();
    }
  }
  return null;
}
