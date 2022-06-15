import { useEffect, useState } from 'react';

export const useOverview = (): { loading: boolean } => {
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  }, []);

  return { loading };
};
