import { useMemo } from 'react';

import { Icon, Image } from '@onekeyhq/components';

// TODO: Need to modify to server data.
const imageIcons: Record<string, string> = {
  uniswap: 'https://uni.onekey-asset.com/static/logo/Uniswap_V3.png',
  pancakeswap: 'https://uni.onekey-asset.com/static/logo/PancakeSwap.png',
  jupiter: 'https://uni.onekey-asset.com/static/logo/Jupiter.png',
  raydium: 'https://uni.onekey-asset.com/static/logo/Raydium.png',
  meteora: 'https://uni.onekey-asset.com/static/logo//Meteora.png',
  curve: 'https://uni.onekey-asset.com/static/logo/Curve.png',
  orca: 'https://uni.onekey-asset.com/static/logo/orca.png',
};
export function MarketPoolIcon({ id }: { id: string }) {
  const idName = id.toLowerCase();
  const imageSource = useMemo(() => {
    const iconKey = Object.keys(imageIcons).find((key) => idName.includes(key));
    return iconKey ? imageIcons[iconKey] : undefined;
  }, [idName]);

  if (imageSource) {
    return <Image size="$5" borderRadius="$full" src={imageSource} />;
  }
  return <Icon size="$5" borderRadius="$full" name="SwitchHorOutline" />;
}
