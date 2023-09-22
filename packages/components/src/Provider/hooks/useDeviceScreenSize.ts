import { useMemo } from 'react';

import useProviderValue from './useProviderValue';

export default function useDeviceScreenSize() {
  const context = useProviderValue();
  return useMemo(() => context.deviceScreenSize, [context.deviceScreenSize]);
}
