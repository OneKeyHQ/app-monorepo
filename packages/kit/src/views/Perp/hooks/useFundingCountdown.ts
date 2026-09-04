import { useEffect, useState } from 'react';

// Count down to the provided funding settlement, or the next full UTC hour.
export function useFundingCountdown(nextFundingTime?: number | null) {
  const [countdown, setCountdown] = useState('00:00');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
      const resolvedNextFundingTime =
        nextFundingTime && nextFundingTime > now.getTime()
          ? nextFundingTime
          : nextHour.getTime();

      const diff = resolvedNextFundingTime - now.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(
        `${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`,
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextFundingTime]);

  return countdown;
}
