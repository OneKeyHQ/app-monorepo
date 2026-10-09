import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Linking, useWindowDimensions } from 'react-native';

import {
  Dialog,
  Icon,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { useShareActions } from '@onekeyhq/kit/src/views/RookieGuide/components/RookieShare/useShareActions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { openSettings } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { ReferFriendsTestIDs } from '../../testIDs';

import {
  REFERRAL_SHARE_COPY,
  buildTelegramShareUrl,
  buildXShareUrl,
} from './referralShareCopy';
import { ShareView } from './ShareView';

import type {
  IReferralShareData,
  IReferralShareImageGeneratorRef,
} from './types';

let isDialogShowing = false;

// Dialog chrome around the preview: header, paddings and the action row.
const PREVIEW_RESERVED_HEIGHT = 300;
const PREVIEW_MIN_HEIGHT = 240;
// The dialog's modal sits above the system share sheet on native; it closes
// first and the sheet opens once the close animation is done.
const DIALOG_CLOSE_ANIMATION_MS = 350;

function ShareAction({
  icon,
  label,
  testID,
  disabled,
  onPress,
}: {
  icon: IKeyOfIcons;
  label: string;
  testID: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <YStack
      testID={testID}
      flex={1}
      ai="center"
      gap="$1.5"
      opacity={disabled ? 0.5 : 1}
      pressStyle={{ opacity: 0.6 }}
      onPress={disabled ? undefined : onPress}
    >
      <Stack
        w="$12"
        h="$12"
        borderRadius="$full"
        bg="$bgStrong"
        ai="center"
        jc="center"
      >
        <Icon name={icon} size="$6" color="$icon" />
      </Stack>
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
    </YStack>
  );
}

function ReferralShareContent({
  data,
  closeDialog,
}: {
  data: IReferralShareData;
  closeDialog: () => Promise<void> | void;
}) {
  const intl = useIntl();
  const generatorRef = useRef<IReferralShareImageGeneratorRef | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  const previewMaxHeight = Math.max(
    PREVIEW_MIN_HEIGHT,
    windowHeight - PREVIEW_RESERVED_HEIGHT,
  );
  const { saveImage, shareImage } = useShareActions();
  const { copyText } = useClipboard();
  const [isActionLoading, setIsActionLoading] = useState(false);

  const runWithImage = useCallback(
    async (action: (base64: string) => Promise<void>) => {
      setIsActionLoading(true);
      try {
        const base64 = (await generatorRef.current?.generate()) ?? '';
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
    [intl],
  );

  const handleSave = useCallback(async () => {
    defaultLogger.referral.page.shareReferralLink('save');
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
  }, [intl, runWithImage, saveImage]);

  const handleCopyLink = useCallback(() => {
    defaultLogger.referral.page.shareReferralLink('copy');
    copyText(data.inviteUrl);
  }, [copyText, data.inviteUrl]);

  const handleX = useCallback(() => {
    defaultLogger.referral.page.shareReferralLink('x');
    void Linking.openURL(buildXShareUrl(data.copy.shareText, data.inviteUrl));
  }, [data.copy.shareText, data.inviteUrl]);

  const handleTelegram = useCallback(() => {
    defaultLogger.referral.page.shareReferralLink('telegram');
    void Linking.openURL(
      buildTelegramShareUrl(data.copy.shareText, data.inviteUrl),
    );
  }, [data.copy.shareText, data.inviteUrl]);

  // The system share sheet is the only path that carries the image to other
  // apps; X and Telegram take text and the link.
  const handleMore = useCallback(async () => {
    defaultLogger.referral.page.shareReferralLink('share');
    await runWithImage(async (base64) => {
      await closeDialog();
      await timerUtils.wait(DIALOG_CLOSE_ANIMATION_MS);
      await shareImage(base64);
    });
  }, [closeDialog, runWithImage, shareImage]);

  return (
    <YStack gap="$5" pb="$4">
      <ShareView
        data={data}
        generatorRef={generatorRef}
        maxHeight={previewMaxHeight}
      />
      <XStack>
        <ShareAction
          testID={ReferFriendsTestIDs.shareSaveBtn}
          icon="DownloadOutline"
          label={REFERRAL_SHARE_COPY.save}
          disabled={isActionLoading}
          onPress={() => {
            void handleSave();
          }}
        />
        <ShareAction
          testID={ReferFriendsTestIDs.shareCopyLinkBtn}
          icon="LinkOutline"
          label={REFERRAL_SHARE_COPY.copyLink}
          onPress={handleCopyLink}
        />
        <ShareAction
          testID={ReferFriendsTestIDs.shareXBtn}
          icon="Xbrand"
          label={REFERRAL_SHARE_COPY.x}
          onPress={handleX}
        />
        <ShareAction
          testID={ReferFriendsTestIDs.shareTelegramBtn}
          icon="TelegramBrand"
          label={REFERRAL_SHARE_COPY.telegram}
          onPress={handleTelegram}
        />
        <ShareAction
          testID={ReferFriendsTestIDs.shareMoreBtn}
          icon="DotHorOutline"
          label={REFERRAL_SHARE_COPY.more}
          disabled={isActionLoading}
          onPress={() => {
            void handleMore();
          }}
        />
      </XStack>
    </YStack>
  );
}

// The invite footer's "Invite friends": a preview of the share card with
// save, copy link, X, Telegram and the system share sheet.
export function showReferralShareDialog(data: IReferralShareData) {
  if (isDialogShowing) {
    return null;
  }
  isDialogShowing = true;

  // renderContent is built before Dialog.show returns, so the content gets a
  // late-bound handle to the dialog instance.
  const dialogControl: { close?: () => Promise<void> | void } = {};
  try {
    const dialogInstance = Dialog.show({
      // eslint-disable-next-line onekey/no-app-locale-main-thread
      title: appLocale.intl.formatMessage({
        id: ETranslations.explore_share,
      }),
      renderContent: (
        <ReferralShareContent
          data={data}
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
