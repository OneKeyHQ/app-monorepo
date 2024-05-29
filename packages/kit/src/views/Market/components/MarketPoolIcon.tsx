import { Icon, Image, Skeleton } from '@onekeyhq/components';

export function MarketPoolIcon({ uri }: { uri: string }) {
  return (
    <Image size="$5" borderRadius="$full">
      <Image.Source src={uri} />
      <Image.Fallback>
        <Icon borderRadius="$full" name="SwitchHorOutline" />
      </Image.Fallback>
      <Image.Loading>
        <Skeleton width="100%" height="100%" />
      </Image.Loading>
    </Image>
  );
}
