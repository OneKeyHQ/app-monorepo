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

const buildShareFileName = () => `onekey-share-${Date.now()}.png`;

// Whether a real system share surface exists on this platform. When false,
// share would silently duplicate "save", so callers should hide the entry.
export function canShareImageToSystem(): boolean {
  if (platformEnv.isNative) {
    return true;
  }
  if (platformEnv.isDesktop) {
    // Electron only implements the system share picker (ShareMenu) on macOS
    return !!platformEnv.isDesktopMac;
  }
  try {
    const probe = new File([''], 'probe.png', { type: 'image/png' });
    return !!navigator.share && !!navigator.canShare?.({ files: [probe] });
  } catch {
    return false;
  }
}

const downloadImageFile = async (base64Image: string) => {
  const blob = await fetch(base64Image).then((r) => r.blob());
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = buildShareFileName();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

export function useShareActions(referralUrl?: string) {
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

          const filename = buildShareFileName();
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
                testID="rookie-guide-open-photo-library-btn"
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

        await downloadImageFile(base64Image);

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

        const filename = buildShareFileName();
        const filepath = `${RNFS.CachesDirectoryPath}/${filename}`;

        await RNFS.writeFile(
          filepath,
          base64Image.replace(/^data:image\/\w+;base64,/, ''),
          'base64',
        );

        try {
          await Sharing.shareAsync(`file://${filepath}`, {
            mimeType: 'image/png',
            dialogTitle: 'Share',
          });
        } finally {
          await RNFS.unlink(filepath).catch(() => {});
        }
      } else if (platformEnv.isDesktop) {
        // Electron has no navigator.share; on macOS the main process pops the
        // native share picker (ShareMenu). Other desktop platforms have no
        // system share — the entry is hidden via canShareImageToSystem(), and
        // saving the file stays as the last-resort fallback.
        const shared: boolean =
          await globalThis.desktopApiProxy.system.shareImageFile({
            base64Image,
          });
        if (!shared) {
          await downloadImageFile(base64Image);
        }
      } else {
        const blob = await fetch(base64Image).then((r) => r.blob());
        const file = new File([blob], buildShareFileName(), {
          type: 'image/png',
        });

        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Share',
          });
        } else {
          // Fallback: download
          await downloadImageFile(base64Image);
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
    if (referralUrl) {
      try {
        copyText(referralUrl);
      } catch {
        Toast.error({ title: 'Failed to copy link' });
      }
    }
  }, [copyText, referralUrl]);

  const shareToX = useCallback(
    async (_base64Image: string, text: string) => {
      try {
        const tweetText = referralUrl ? `${text}\n\n${referralUrl}` : text;
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
    [referralUrl],
  );

  return {
    saveImage,
    shareImage,
    copyLink,
    shareToX,
  };
}
