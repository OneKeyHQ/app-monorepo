import { Icon, Stack } from '@onekeyhq/components';
import {
  type ITokenSize,
  Token,
  getTokenImageResizeWidth,
} from '@onekeyhq/kit/src/components/Token';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function BorrowAssetToken({
  size,
  logoURI,
}: {
  size: ITokenSize;
  logoURI?: string;
}) {
  return (
    <Token
      size={size}
      tokenImageUri={logoURI}
      // Match the prewarm request's native cache identity. Without the same
      // resize hint, a prewarmed image can still be fetched again on iOS.
      resizeWidth={getTokenImageResizeWidth(size)}
      {...(platformEnv.isNative
        ? {
            placeholder: (
              <Stack
                width="100%"
                height="100%"
                borderRadius="$full"
                bg="$bgStrong"
                ai="center"
                jc="center"
              >
                <Icon name="CryptoCoinOutline" size="$5" color="$iconSubdued" />
              </Stack>
            ),
            loadingStrategy: 'static' as const,
          }
        : {})}
    />
  );
}
