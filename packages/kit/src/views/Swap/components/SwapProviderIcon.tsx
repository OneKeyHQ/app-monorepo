import type { IImageProps } from '@onekeyhq/components';
import { Icon, Image, Stack } from '@onekeyhq/components';

type ISwapProviderIconProps = {
  providerLogo?: string;
  lock?: boolean;
} & IImageProps;

export function SwapProviderIcon({
  providerLogo,
  lock,
  ...props
}: ISwapProviderIconProps) {
  return (
    <>
      <Image size="$10" borderRadius="$2" delayMs={1000} {...props}>
        <Image.Source
          source={{
            uri: providerLogo,
          }}
        />
        <Image.Fallback
          alignItems="center"
          justifyContent="center"
          bg="$bgStrong"
        >
          <Icon name="Image2MountainsSolid" color="$iconDisabled" />
        </Image.Fallback>
      </Image>
      {lock ? (
        <Stack
          p="$0.5"
          borderRadius="$full"
          bg="$bgSubdued"
          position="absolute"
          right="$-1"
          bottom="$-1"
        >
          <Icon size="$4" name="LockOutline" />
        </Stack>
      ) : null}
    </>
  );
}
