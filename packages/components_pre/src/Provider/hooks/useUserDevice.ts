import { useMemo } from 'react';

import { freezedEmptyObject } from '@onekeyhq/shared/src/consts/sharedConsts';

import useProviderValue from './useProviderValue';

export default function useUserDevice() {
  const context = useProviderValue();
  return useMemo(() => context.device || freezedEmptyObject, [context.device]);
}
