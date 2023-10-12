import { useMemo } from 'react';

import useProviderDeviceScreenSize from './useProviderDeviceScreenSize';

export default function useDeviceScreenSize() {
  const context = useProviderDeviceScreenSize();
  return useMemo(() => context.deviceScreenSize, [context.deviceScreenSize]);
}
