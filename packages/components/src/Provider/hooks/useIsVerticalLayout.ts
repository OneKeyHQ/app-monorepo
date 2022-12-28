import { useMemo } from 'react';

import useUserDevice from './useUserDevice';

export default function useIsVerticalLayout() {
  const { size } = useUserDevice();
  return useMemo(() => ['SMALL'].includes(size), [size]);
}
