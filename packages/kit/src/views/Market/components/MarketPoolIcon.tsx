import { Icon, Image, Skeleton, Stack } from '@onekeyhq/components';

export function MarketPoolIcon({ uri }: { uri: string }) {
  return (
    <Image size="$5" borderRadius="$full">
      <Image.Source src={uri} />
      <Image.Fallback>
        <Stack
          flex={1}
          borderRadius="$full"
          bg="$bgDisabled"
          ai="center"
          jc="center"
        >
          <Icon size="$3.5" color="$iconSubdued" name="SwitchHorOutline" />
        </Stack>
      </Image.Fallback>
      <Image.Loading>
        <Skeleton width="100%" height="100%" />
      </Image.Loading>
    </Image>
  );
}
