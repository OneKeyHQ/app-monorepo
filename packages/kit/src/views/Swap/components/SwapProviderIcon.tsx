import { useIntl } from 'react-intl';

import type { IImageProps } from '@onekeyhq/components';
import { Icon, Image, SizableText, Stack, Tooltip } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type ISwapProviderIconProps = {
  providerLogo?: string;
  lock?: boolean;
} & IImageProps;

export function SwapProviderIcon({
  providerLogo,
  lock,
  ...props
}: ISwapProviderIconProps) {
  const intl = useIntl();
  return (
    <>
      <Image
        src={providerLogo}
        size="$10"
        borderRadius="$2"
        {...props}
        fallback={
          <Image.Fallback
            alignItems="center"
            justifyContent="center"
            bg="$bgStrong"
          >
            <Icon
              name="Image2MountainsSolid"
              color="$iconDisabled"
              size="$10"
            />
          </Image.Fallback>
        }
      />
      {lock ? (
        <Tooltip
          renderTrigger={
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
          }
          renderContent={
            <SizableText size="$bodySm" color="$text">
              {intl.formatMessage({
                id: ETranslations.provider_approval_require,
              })}
            </SizableText>
          }
          placement="bottom-start"
        />
      ) : null}
    </>
  );
}
