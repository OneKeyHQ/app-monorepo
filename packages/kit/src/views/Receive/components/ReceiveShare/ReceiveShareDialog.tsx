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

import { SHARE_CARD_CONFIG } from './constants';
import { ControlPanel } from './ControlPanel';
import { ShareView } from './ShareView';

import type {
  IReceiveShareData,
  IReceiveShareImageGeneratorRef,
} from './types';

// Track if a dialog is currently showing to prevent duplicate dialogs
let isDialogShowing = false;

// estimated dialog chrome around the preview: header + paddings + action row
const PREVIEW_RESERVED_HEIGHT = 260;
const PREVIEW_MIN_HEIGHT = 240;
// time for the dialog close animation to finish before presenting the
// system share sheet on native
const DIALOG_CLOSE_ANIMATION_MS = 350;

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
  const previewMaxHeight = Math.max(
    PREVIEW_MIN_HEIGHT,
    windowHeight - PREVIEW_RESERVED_HEIGHT,
  );

  const { saveImage, shareImage } = useShareActions();
  const [isActionLoading, setIsActionLoading] = useState(false);

  // shared preamble for both actions: loading flag, image fetch, empty guard
  const runWithImage = useCallback(
    async (action: (base64: string) => Promise<void>) => {
      setIsActionLoading(true);
      try {
        const base64: string =
          presetImage || ((await generatorRef.current?.generate()) ?? '');
        if (!base64) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.generate_image_failed__msg,
            }),
          });
          return;
        }
        await action(base64);
      } finally {
        setIsActionLoading(false);
      }
    },
    [presetImage, intl],
  );

  const handleSaveImage = useCallback(async () => {
    await runWithImage(async (base64) => {
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
    });
  }, [runWithImage, saveImage, intl]);

  const handleShareImage = useCallback(async () => {
    await runWithImage(async (base64) => {
      if (platformEnv.isNative) {
        // the dialog's RN modal sits above the system share sheet; dismiss
        // it and wait out the close animation before presenting the sheet
        await closeDialog?.();
        await timerUtils.wait(DIALOG_CLOSE_ANIMATION_MS);
      }
      await shareImage(base64);
    });
  }, [runWithImage, shareImage, closeDialog]);

  const desktopLayout = (
    <YStack gap="$5">
      <Stack
        width={SHARE_CARD_CONFIG.width}
        testID={ReceiveTestIDs.ShareDialogPreview}
      >
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
