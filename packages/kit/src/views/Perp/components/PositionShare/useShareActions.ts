import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { Linking } from 'react-native';

import { Toast, useClipboard } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import ExpoSharing from '@onekeyhq/shared/src/modules3rdParty/expo-sharing';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useShareActions(referralQrCodeUrl?: string) {
  const { copyText } = useClipboard();
  const intl = useIntl();
  const saveImage = useCallback(
    async (base64Image: string) => {
      try {
        if (platformEnv.isNative) {
          if (!RNFS || !ExpoSharing) {
            Toast.error({ title: 'File system not available' });
            return;
          }

          const filename = `onekey-position-${Date.now()}.png`;
          const filepath = platformEnv.isNativeAndroid
            ? `${RNFS.CachesDirectoryPath}/${filename}`
            : `${RNFS.DocumentDirectoryPath}/${filename}`;

          await RNFS.writeFile(
            filepath,
            base64Image.replace(/^data:image\/\w+;base64,/, ''),
            'base64',
          );

          const shareFilePath = platformEnv.isNativeAndroid
            ? `file://${filepath}`
            : filepath;

          await ExpoSharing.shareAsync(shareFilePath, {
            mimeType: 'image/png',
            UTI: 'public.png',
          });
        } else {
          const byteString = atob(base64Image.split(',')[1]);
          const arrayBuffer = new ArrayBuffer(byteString.length);
          const uint8Array = new Uint8Array(arrayBuffer);
          for (let i = 0; i < byteString.length; i += 1) {
            uint8Array[i] = byteString.charCodeAt(i);
          }

          const blob = new Blob([uint8Array], { type: 'image/png' });
          const url = URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.href = url;
          link.download = `onekey-position-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          URL.revokeObjectURL(url);

          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.perp_share_image_saved,
            }),
          });
        }
      } catch (error) {
        Toast.error({
          title: 'Failed to save image',
          message: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [intl],
  );

  const copyLink = useCallback(() => {
    if (referralQrCodeUrl) {
      try {
        copyText(referralQrCodeUrl);
      } catch {
        Toast.error({ title: 'Failed to copy link' });
      }
    }
  }, [copyText, referralQrCodeUrl]);

  const shareToX = useCallback(
    async (_base64Image: string, text: string) => {
      try {
        const tweetText = referralQrCodeUrl
          ? `${text}\n\n${referralQrCodeUrl}`
          : text;
        const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
          tweetText,
        )}`;

        if (platformEnv.isNative) {
          void Linking.openURL(twitterUrl);
        } else {
          globalThis.open(twitterUrl, '_blank');
        }
      } catch (error) {
        Toast.error({
          title: 'Failed to share',
          message: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [referralQrCodeUrl],
  );

  return {
    saveImage,
    copyLink,
    shareToX,
  };
}
