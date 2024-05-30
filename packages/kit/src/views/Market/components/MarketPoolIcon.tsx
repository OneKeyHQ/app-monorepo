import { Icon, Image } from '@onekeyhq/components';

export function MarketPoolIcon({ uri }: { uri: string }) {
  return (
    <Image size="$5" borderRadius="$full">
      <Image.Source src={uri} />
      <Image.Fallback>
        <Icon size="$5" borderRadius="$full" name="SwitchHorOutline" />
      </Image.Fallback>
    </Image>
  );
}
