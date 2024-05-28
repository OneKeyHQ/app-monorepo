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
export function MarketPoolIcon({ id, uri }: { id: string; uri: string }) {
  const idName = id.toLowerCase();
  const imageSource = useMemo(() => {
    if (uri) {
      return uri;
    }
    const iconKey = Object.keys(imageIcons).find((key) => idName.includes(key));
    return iconKey ? imageIcons[iconKey] : undefined;
  }, [idName, uri]);

  return (
    <Image size="$5" borderRadius="$full">
      <Image.Source src={imageSource} />
      <Image.Fallback>
        <Icon size="$5" borderRadius="$full" name="SwitchHorOutline" />
      </Image.Fallback>
    </Image>
  );
}
