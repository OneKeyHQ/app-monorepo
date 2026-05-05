import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { useInPageDialog } from '@onekeyhq/components';
import { Dialog, Stack, Toast, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IRookieShareData,
  IRookieShareImageGeneratorRef,
} from '@onekeyhq/shared/types/rookieGuide';

import { ControlPanel } from './ControlPanel';
import { ShareView } from './ShareView';
import { useShareActions } from './useShareActions';

// Track if a dialog is currently showing to prevent duplicate dialogs
let isDialogShowing = false;

interface IShareContentProps {
  data: IRookieShareData;
  onClose?: () => void;
  actionTaken?: { current: boolean };
  isMobile?: boolean;
}

function ShareContent({
  data,
  onClose,
  actionTaken,
  isMobile,
}: IShareContentProps) {
  const generatorRef = useRef<IRookieShareImageGeneratorRef | null>(null);
  const intl = useIntl();

  const { referralUrl, title } = data;
  const { saveImage, shareImage, copyLink, shareToX } =
    useShareActions(referralUrl);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const trackAction = useCallback(
    (action: 'save' | 'share' | 'copy' | 'x') => {
      if (actionTaken) actionTaken.current = true;
      defaultLogger.rookieGuide.share.shareRookieLink(action);
    },
    [actionTaken],
  );

  const handleSaveImage = useCallback(async () => {
    trackAction('save');
    setIsActionLoading(true);
    try {
      const generator: IRookieShareImageGeneratorRef | null =
        generatorRef.current;
      if (!generator) {
        Toast.error({ title: 'Failed to generate image' });
        return;
      }
      const base64: string = await generator.generate();
      if (!base64) {
        Toast.error({ title: 'Failed to generate image' });
        return;
      }

      const result = await saveImage(base64);

      if (result?.permissionPermanentlyDenied) {
        Dialog.show({
          tone: 'warning',
          icon: 'ErrorOutline',
          title: 'Photo Library Access Denied',
          description:
            'OneKey requires photo library access to save images. Please go to Settings and enable photo library permissions.',
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
  }, [saveImage, intl, trackAction]);

  const handleShareImage = useCallback(async () => {
    trackAction('share');
    setIsActionLoading(true);
    try {
      const generator: IRookieShareImageGeneratorRef | null =
        generatorRef.current;
      if (!generator) {
        Toast.error({ title: 'Failed to generate image' });
        return;
      }
      const base64: string = await generator.generate();
      if (!base64) {
        Toast.error({ title: 'Failed to generate image' });
        return;
      }

      await shareImage(base64);
    } finally {
      setIsActionLoading(false);
    }
  }, [shareImage, trackAction]);

  const handleCopyLink = useCallback(() => {
    trackAction('copy');
    copyLink();
  }, [copyLink, trackAction]);

  const handleShareToX = useCallback(async () => {
    trackAction('x');
    setIsActionLoading(true);
    try {
      const generator: IRookieShareImageGeneratorRef | null =
        generatorRef.current;
      if (!generator) {
        Toast.error({ title: 'Failed to generate image' });
        return;
      }
      const base64: string = await generator.generate();
      if (!base64) {
        Toast.error({ title: 'Failed to generate image' });
        return;
      }

      if (platformEnv.isNative && onClose) {
        onClose();
      }

      // Use title as share text
      await shareToX(base64, title);
    } finally {
      setIsActionLoading(false);
    }
  }, [shareToX, title, onClose, trackAction]);

  const desktopLayout = (
    <YStack gap="$5">
      <Stack width={360}>
        <ShareView data={data} generatorRef={generatorRef} />
      </Stack>
      <ControlPanel
        onSaveImage={handleSaveImage}
        onShareImage={handleShareImage}
        onCopyLink={handleCopyLink}
        onShareToX={handleShareToX}
        isLoading={isActionLoading}
        isMobile={false}
        hasReferralUrl={!!referralUrl}
      />
    </YStack>
  );

  const mobileLayout = (
    <YStack gap="$5" width="100%">
      <ShareView data={data} generatorRef={generatorRef} />
      <ControlPanel
        onSaveImage={handleSaveImage}
        onShareImage={handleShareImage}
        onCopyLink={handleCopyLink}
        onShareToX={handleShareToX}
        isLoading={isActionLoading}
        isMobile
        hasReferralUrl={!!referralUrl}
      />
    </YStack>
  );

  return isMobile ? mobileLayout : desktopLayout;
}

export function showRookieShareDialog(
  data: IRookieShareData,
  dialog?: ReturnType<typeof useInPageDialog>,
) {
  // Prevent duplicate dialogs
  if (isDialogShowing) {
    return null;
  }

  isDialogShowing = true;

  defaultLogger.rookieGuide.share.enterRookieShare({
    isLoggedIn: !!data.referralCode,
    referralCode: data.referralCode ?? '',
  });

  const actionTaken = { current: false };

  try {
    const DialogInstance = dialog ?? Dialog;

    const dialogInstance = DialogInstance.show({
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
          onClose={() => {
            void dialogInstance.close();
          }}
          actionTaken={actionTaken}
          isMobile={platformEnv.isNative}
        />
      ),
      showFooter: false,
      onClose: () => {
        isDialogShowing = false;
        defaultLogger.rookieGuide.share.closeRookieShare({
          didAction: actionTaken.current,
          referralCode: data.referralCode ?? '',
        });
      },
    });

    return dialogInstance;
  } catch (error) {
    isDialogShowing = false;
    throw error;
  }
}
