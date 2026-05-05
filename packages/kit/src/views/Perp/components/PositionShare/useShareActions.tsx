import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { Linking } from 'react-native';

import { Button, Toast, useClipboard } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import MediaLibrary from '@onekeyhq/shared/src/modules3rdParty/expo-media-library';
import Sharing from '@onekeyhq/shared/src/modules3rdParty/expo-sharing';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type ISaveImageResult = {
  success: boolean;
  permissionDenied?: boolean;
  permissionPermanentlyDenied?: boolean;
};

export function useShareActions(referralQrCodeUrl?: string) {
  const { copyText } = useClipboard();
  const intl = useIntl();

  const saveImage = useCallback(
    async (base64Image: string): Promise<ISaveImageResult> => {
      try {
        if (platformEnv.isNative) {
          if (!RNFS) {
            Toast.error({ title: 'File system not available' });
            return { success: false };
          }

          // writeOnly: true for iOS 14+ add-only permission
          let currentPermission: {
            status: string;
            canAskAgain?: boolean;
          } | null = null;

          try {
            currentPermission = await MediaLibrary.getPermissionsAsync(true);
          } catch (error) {
            console.error('Get permissions failed:', error);
          }

          const isGranted = currentPermission?.status === 'granted';
          const canRequest =
            currentPermission?.status === 'undetermined' ||
            (currentPermission?.status === 'denied' &&
              currentPermission?.canAskAgain !== false);

          if (!isGranted && canRequest) {
            try {
              const requestResult =
                await MediaLibrary.requestPermissionsAsync(true);
              if (requestResult?.status !== 'granted') {
                return { success: false, permissionDenied: true };
              }
            } catch (permissionError) {
              console.error('Permission request failed:', permissionError);
              return { success: false, permissionDenied: true };
            }
          } else if (!isGranted && !canRequest) {
            return { success: false, permissionPermanentlyDenied: true };
          }

          const filename = `onekey-position-${Date.now()}.png`;
          const filepath = `${RNFS.CachesDirectoryPath}/${filename}`;

          await RNFS.writeFile(
            filepath,
            base64Image.replace(/^data:image\/\w+;base64,/, ''),
            'base64',
          );

          await MediaLibrary.saveToLibraryAsync(filepath);
          await RNFS.unlink(filepath);

          const openPhotoLibrary = () => {
            if (platformEnv.isNativeAndroid) {
              void Linking.openURL(
                'content://media/external/images/media',
              ).catch(() => {});
            } else {
              void Linking.openURL('photos-redirect://');
            }
          };

          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.perp_share_image_saved,
            }),
            actionsAlign: 'left',
            actions: (
              <Button
                variant="tertiary"
                size="small"
                onPress={openPhotoLibrary}
              >
                {intl.formatMessage({ id: ETranslations.global_view })}
              </Button>
            ),
          });

          return { success: true };
        }
        // Web platform
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

        return { success: true };
      } catch (error) {
        Toast.error({
          title: 'Failed to save image',
          message: error instanceof Error ? error.message : undefined,
        });
        return { success: false };
      }
    },
    [intl],
  );

  const shareImage = useCallback(async (base64Image: string) => {
    try {
      if (platformEnv.isNative) {
        if (!RNFS) {
          Toast.error({ title: 'File system not available' });
          return;
        }

        const filename = `onekey-position-${Date.now()}.png`;
        const filepath = `${RNFS.CachesDirectoryPath}/${filename}`;

        await RNFS.writeFile(
          filepath,
          base64Image.replace(/^data:image\/\w+;base64,/, ''),
          'base64',
        );

        await Sharing.shareAsync(`file://${filepath}`, {
          mimeType: 'image/png',
          dialogTitle: 'Share Position',
        });

        await RNFS.unlink(filepath);
      } else {
        // Web: Use Web Share API if available
        const byteString = atob(base64Image.split(',')[1]);
        const arrayBuffer = new ArrayBuffer(byteString.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        for (let i = 0; i < byteString.length; i += 1) {
          uint8Array[i] = byteString.charCodeAt(i);
        }

        const blob = new Blob([uint8Array], { type: 'image/png' });
        const file = new File([blob], `onekey-position-${Date.now()}.png`, {
          type: 'image/png',
        });

        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Share Position',
          });
        } else {
          // Fallback: download
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `onekey-position-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      // User cancelled share - not an error
      if (error instanceof Error && error.message?.includes('cancel')) {
        return;
      }
      Toast.error({
        title: 'Failed to share',
        message: error instanceof Error ? error.message : undefined,
      });
    }
  }, []);

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
    shareImage,
    copyLink,
    shareToX,
  };
}
