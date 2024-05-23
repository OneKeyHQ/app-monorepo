import { useMemo } from 'react';

import type { IIconProps } from '@onekeyhq/components';
import { Icon } from '@onekeyhq/components';

export function MarketPoolIcon({ id }: { id: string }) {
  const iconProps: IIconProps = useMemo(() => {
    const idName = id.toLowerCase();
    if (idName.includes('uniswap')) {
      return {
        name: 'UniswapBrand',
        color: '#ff007a' as IIconProps['color'],
      };
    }
    if (idName.includes('pancakeswap')) {
      return {
        name: 'SwitchHorOutline',
      };
    }
    return {
      name: 'SwitchHorOutline',
    };
  }, [id]);
  return <Icon size="$5" borderRadius="$full" {...iconProps} />;
}
