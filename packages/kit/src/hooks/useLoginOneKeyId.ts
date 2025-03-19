import { useCallback, useMemo } from 'react';

export const useLoginOneKeyId = () => {
  const loginOneKeyId = useCallback(() => {}, []);
  return useMemo(() => ({ loginOneKeyId }), [loginOneKeyId]);
};
