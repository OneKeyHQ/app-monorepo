import { useState } from 'react';

/**
 * When the current `value` arrived: taken at mount, and again each time a new
 * value (by identity) replaces it.
 */
export function useArrivalTime(value: unknown): number {
  const [arrival, setArrival] = useState(() => ({ value, time: Date.now() }));
  // Set during render, so a new value never paints with the old time.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (arrival.value !== value) {
    setArrival({ value, time: Date.now() });
  }
  return arrival.time;
}
