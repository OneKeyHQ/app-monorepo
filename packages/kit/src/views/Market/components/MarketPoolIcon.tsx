import { Icon, Image, Stack } from '@onekeyhq/components';

export function MarketPoolIcon({ uri }: { uri: string }) {
  return (
    <Image
      size="$5"
      borderRadius="$full"
      source={{ uri }}
      fallback={
        <Image.Fallback>
          <Stack
            w="$5"
            h="$5"
            borderRadius="$full"
            bg="$bgDisabled"
            ai="center"
            jc="center"
          >
            <Icon size="$3.5" color="$iconSubdued" name="SwitchHorOutline" />
          </Stack>
        </Image.Fallback>
      }
    />
  );
}
