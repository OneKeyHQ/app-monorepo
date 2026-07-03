import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Stack, Toast, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useShareActions } from '../../../RookieGuide/components/RookieShare/useShareActions';
import { ReceiveTestIDs } from '../../testIDs';

import { ControlPanel } from './ControlPanel';
import { ShareView } from './ShareView';

import type {
  IReceiveShareData,
  IReceiveShareImageGeneratorRef,
} from './types';

// Track if a dialog is currently showing to prevent duplicate dialogs
let isDialogShowing = false;

interface IShareContentProps {
  data: IReceiveShareData;
  isMobile?: boolean;
}

function ShareContent({ data, isMobile }: IShareContentProps) {
  const generatorRef = useRef<IReceiveShareImageGeneratorRef | null>(null);
  const intl = useIntl();

  const { saveImage, shareImage } = useShareActions();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleSaveImage = useCallback(async () => {
    setIsActionLoading(true);
    try {
      const generator: IReceiveShareImageGeneratorRef | null =
        generatorRef.current;
      if (!generator) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.generate_image_failed__msg,
          }),
        });
        return;
      }
      const base64: string = await generator.generate();
      if (!base64) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.generate_image_failed__msg,
          }),
        });
        return;
      }

      const result = await saveImage(base64);

      if (result?.permissionPermanentlyDenied) {
        Dialog.show({
          tone: 'warning',
          icon: 'ErrorOutline',
          title: intl.formatMessage({
            id: ETranslations.photo_library_access_denied__title,
          }),
          description: intl.formatMessage({
            id: ETranslations.photo_library_access_denied__desc,
          }),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_go_settings,
          }),
          showCancelButton: true,
          showConfirmButton: true,
          onConfirm: () => {
            openSettings('camera');
          },
        });
      }
    } finally {
      setIsActionLoading(false);
    }
  }, [saveImage, intl]);

  const handleShareImage = useCallback(async () => {
    setIsActionLoading(true);
    try {
      const generator: IReceiveShareImageGeneratorRef | null =
        generatorRef.current;
      if (!generator) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.generate_image_failed__msg,
          }),
        });
        return;
      }
      const base64: string = await generator.generate();
      if (!base64) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.generate_image_failed__msg,
          }),
        });
        return;
      }

      await shareImage(base64);
    } finally {
      setIsActionLoading(false);
    }
  }, [shareImage, intl]);

  const desktopLayout = (
    <YStack gap="$5">
      <Stack width={360} testID={ReceiveTestIDs.ShareDialogPreview}>
        <ShareView data={data} generatorRef={generatorRef} />
      </Stack>
      <ControlPanel
        onSaveImage={handleSaveImage}
        onShareImage={handleShareImage}
        isLoading={isActionLoading}
        isMobile={false}
      />
    </YStack>
  );

  const mobileLayout = (
    <YStack gap="$5" width="100%" testID={ReceiveTestIDs.ShareDialogPreview}>
      <ShareView data={data} generatorRef={generatorRef} />
      <ControlPanel
        onSaveImage={handleSaveImage}
        onShareImage={handleShareImage}
        isLoading={isActionLoading}
        isMobile
      />
    </YStack>
  );

  return isMobile ? mobileLayout : desktopLayout;
}

export function showReceiveShareDialog(data: IReceiveShareData) {
  // Prevent duplicate dialogs
  if (isDialogShowing) {
    return null;
  }

  isDialogShowing = true;

  try {
    const dialogInstance = Dialog.show({
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage({
        id: ETranslations.explore_share,
      }),
      floatingPanelProps: platformEnv.isNative
        ? undefined
        : {
            width: 'autoWidth',
          },
      renderContent: (
        <ShareContent data={data} isMobile={platformEnv.isNative} />
      ),
      showFooter: false,
      onClose: () => {
        isDialogShowing = false;
      },
    });

    return dialogInstance;
  } catch (error) {
    isDialogShowing = false;
    throw error;
  }
}
