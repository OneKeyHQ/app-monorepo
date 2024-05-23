import { useMemo } from 'react';

import type { IIconProps } from '@onekeyhq/components';
import { Icon, Image } from '@onekeyhq/components';

import type { ImageURISource } from 'react-native';

const imageIcons: Record<string, ImageURISource> = {
  pancakeswap: require('@onekeyhq/kit/assets/brand/pancakeswap.png'),
  jupiter: require('@onekeyhq/kit/assets/brand/jupiter.png'),
  raydium: require('@onekeyhq/kit/assets/brand/raydium.png'),
  meteora: require('@onekeyhq/kit/assets/brand/meteora.png'),
  curve: require('@onekeyhq/kit/assets/brand/curve.png'),
  orca: require('@onekeyhq/kit/assets/brand/orca.png'),
};
export function MarketPoolIcon({ id }: { id: string }) {
  const idName = id.toLowerCase();
  const imageSource = useMemo(() => {
    const iconKey = Object.keys(imageIcons).find((key) => idName.includes(key));
    return iconKey ? imageIcons[iconKey] : undefined;
  }, [idName]);
  const iconProps: IIconProps | undefined = useMemo(() => {
    if (imageSource) {
      return undefined;
    }
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
  }, [idName, imageSource]);
  if (imageSource) {
    return <Image size="$5" borderRadius="$full" source={imageSource} />;
  }
  return <Icon size="$5" borderRadius="$full" {...iconProps} />;
}
