import { useMemo } from 'react';

import useProviderValue from './useProviderValue';

export default function useUserDevice() {
  const context = useProviderValue();
  return useMemo(() => context.device || {}, [context.device]);
}
