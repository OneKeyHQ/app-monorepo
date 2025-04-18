import { useMemo } from 'react';

export function useEarnEventActive(eventEndTime?: number) {
  const [isEventActive, effectiveTime] = useMemo(() => {
    if (typeof eventEndTime !== 'number') {
      return [false, 0];
    }
    return [eventEndTime > Date.now(), eventEndTime];
  }, [eventEndTime]);

  return {
    isEventActive,
    effectiveTime,
  };
}
