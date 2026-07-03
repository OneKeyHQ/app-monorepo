import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import { Dialog, Stack, Toast, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

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
  // image generated before the dialog opened (see ShareView.presetImage)
  presetImage?: string;
  // closes the hosting dialog; used on native to dismiss the RN modal
  // before presenting the system share sheet (it would render behind it)
  closeDialog?: () => Promise<void> | void;
}

function ShareContent({
  data,
  isMobile,
  presetImage,
  closeDialog,
}: IShareContentProps) {
  const generatorRef = useRef<IReceiveShareImageGeneratorRef | null>(null);
  const intl = useIntl();

  // Keep the action row visible: cap the preview height so the image
  // contain-fits (shrinks proportionally) instead of pushing the buttons
  // past the viewport (ext popup is only 600px tall).
  // Reserved space ≈ dialog header + paddings + action row.
  const { height: windowHeight } = useWindowDimensions();
  const previewMaxHeight = Math.max(240, windowHeight - 260);

  const { saveImage, shareImage } = useShareActions();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const getShareImage = useCallback(async (): Promise<string> => {
    if (presetImage) return presetImage;
    const generator: IReceiveShareImageGeneratorRef | null =
      generatorRef.current;
    if (!generator) return '';
    return generator.generate();
  }, [presetImage]);

  const handleSaveImage = useCallback(async () => {
    setIsActionLoading(true);
    try {
      const base64: string = await getShareImage();
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
  }, [getShareImage, saveImage, intl]);

  const handleShareImage = useCallback(async () => {
    setIsActionLoading(true);
    try {
      const base64: string = await getShareImage();
      if (!base64) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.generate_image_failed__msg,
          }),
        });
        return;
      }

      if (platformEnv.isNative) {
        // the dialog's RN modal sits above the system share sheet; dismiss
        // it and wait out the close animation before presenting the sheet
        await closeDialog?.();
        await timerUtils.wait(350);
      }
      await shareImage(base64);
    } finally {
      setIsActionLoading(false);
    }
  }, [getShareImage, shareImage, closeDialog, intl]);

  const desktopLayout = (
    <YStack gap="$5">
      <Stack width={360} testID={ReceiveTestIDs.ShareDialogPreview}>
        <ShareView
          data={data}
          generatorRef={generatorRef}
          maxHeight={previewMaxHeight}
          presetImage={presetImage}
        />
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
      <ShareView
        data={data}
        generatorRef={generatorRef}
        maxHeight={previewMaxHeight}
        presetImage={presetImage}
      />
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

export function showReceiveShareDialog(
  data: IReceiveShareData,
  options?: { presetImage?: string },
) {
  // Prevent duplicate dialogs
  if (isDialogShowing) {
    return null;
  }

  isDialogShowing = true;

  // renderContent is built before Dialog.show returns, so hand the content
  // a late-bound handle to the dialog instance
  const dialogControl: { close?: () => Promise<void> | void } = {};

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
        <ShareContent
          data={data}
          isMobile={platformEnv.isNative}
          presetImage={options?.presetImage}
          closeDialog={() => dialogControl.close?.()}
        />
      ),
      showFooter: false,
      onClose: () => {
        isDialogShowing = false;
      },
    });

    dialogControl.close = () => dialogInstance.close();

    return dialogInstance;
  } catch (error) {
    isDialogShowing = false;
    throw error;
  }
}
