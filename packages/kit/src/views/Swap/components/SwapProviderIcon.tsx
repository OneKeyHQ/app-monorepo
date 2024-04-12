import { useMemo } from 'react';

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
  const providerIcon = useMemo(
    () => (
      <Image width="$10" height="$10" borderRadius="$2" {...props}>
        <Image.Source
          source={{
            uri: providerLogo,
          }}
        />
        <Image.Fallback
          alignItems="center"
          justifyContent="center"
          bg="$bgStrong"
          delayMs={1000}
        >
          <Icon size="$7" name="CoinOutline" color="$iconDisabled" />
        </Image.Fallback>
      </Image>
    ),
    [props, providerLogo],
  );
  if (!lock) return providerIcon;
  return (
    <Stack position="relative" width="$10" height="$10">
      {providerIcon}
      <Stack
        position="absolute"
        right="$-1"
        bottom="$-1"
        p="$0.5"
        bg="$bgApp"
        borderRadius="$full"
      >
        <Icon size="$4" name="LockOutline" />
      </Stack>
    </Stack>
  );
}
