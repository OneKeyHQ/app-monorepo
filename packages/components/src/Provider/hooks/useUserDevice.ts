import { useMemo } from 'react';

import useProviderValue from './useProviderValue';

const empty = Object.freeze({});
export default function useUserDevice() {
  const context = useProviderValue();
  return useMemo(() => context.device || empty, [context.device]);
}
