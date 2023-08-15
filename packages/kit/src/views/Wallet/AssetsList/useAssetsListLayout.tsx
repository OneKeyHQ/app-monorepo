import { useMemo } from 'react';

import { useUserDevice } from '@onekeyhq/components';

export function useAssetsListLayout() {
  const { size } = useUserDevice();
  const containerPaddingX: {
    num: number;
    px: string;
  } = useMemo(() => {
    if (['NORMAL', 'LARGE'].includes(size)) return { num: 32, px: '32px' };
    return { num: 16, px: '16px' };
  }, [size]);
  return {
    containerPaddingX,
  };
}
