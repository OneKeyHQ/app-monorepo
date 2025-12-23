import { useCallback, useRef, useState } from 'react';

import type { useInPageDialog } from '@onekeyhq/components';
import { Dialog, Stack, Toast, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { DEFAULT_PNL_DISPLAY_MODE, getDefaultShareText } from './constants';
import { ControlPanel } from './ControlPanel';
import { ShareImageGenerator } from './ShareImageGenerator';
import { ShareView } from './ShareView';
import { useReferralUrl } from './useReferralUrl';
import { useShareActions } from './useShareActions';

import type {
  IShareConfig,
  IShareData,
  IShareImageGeneratorRef,
} from './types';

interface IShareContentProps {
  data: IShareData;
  onClose?: () => void;
  isMobile?: boolean;
}

function ShareContent({ data, onClose, isMobile }: IShareContentProps) {
  const generatorRef = useRef<IShareImageGeneratorRef | null>(null);
  const { side, token, tokenDisplayName } = data;

  const [config, setConfig] = useState<IShareConfig>({
    customText: getDefaultShareText({
      side,
      coin: token,
      displayName: tokenDisplayName,
    }),
    stickerIndex: null,
    backgroundIndex: 0,
    pnlDisplayMode: DEFAULT_PNL_DISPLAY_MODE,
  });

  const {
    referralQrCodeUrl,
    referralDisplayText,
    isReady: isReferralReady,
  } = useReferralUrl();
  const { saveImage, copyLink, shareToX } = useShareActions(referralQrCodeUrl);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleSaveImage = useCallback(async () => {
    setIsActionLoading(true);
    try {
      const generator: IShareImageGeneratorRef | null = generatorRef.current;
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
      await saveImage(base64);
    } finally {
      setIsActionLoading(false);
    }
  }, [saveImage, onClose]);

  const handleShareToX = useCallback(async () => {
    setIsActionLoading(true);
    try {
      const generator: IShareImageGeneratorRef | null = generatorRef.current;
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

      await shareToX(base64, config.customText);
    } finally {
      setIsActionLoading(false);
    }
  }, [shareToX, config.customText, onClose]);

  const desktopLayout = (
    <YStack gap="$5">
      <ShareImageGenerator
        ref={generatorRef}
        data={data}
        config={config}
        referralQrCodeUrl={referralQrCodeUrl}
        referralDisplayText={referralDisplayText}
        isReferralReady={isReferralReady}
      />
      <Stack justifyContent="center" alignItems="center">
        <ShareView
          data={data}
          config={config}
          referralQrCodeUrl={referralQrCodeUrl}
          referralDisplayText={referralDisplayText}
          isReferralReady={isReferralReady}
          scale={0.5}
          generatorRef={generatorRef}
        />
      </Stack>
      <Stack maxWidth={380}>
        <ControlPanel
          config={config}
          onChange={setConfig}
          onSaveImage={handleSaveImage}
          onCopyLink={copyLink}
          onShareToX={handleShareToX}
          isLoading={isActionLoading}
        />
      </Stack>
    </YStack>
  );

  const mobileLayout = (
    <YStack flex={1}>
      <ShareImageGenerator
        ref={generatorRef}
        data={data}
        config={config}
        referralQrCodeUrl={referralQrCodeUrl}
        referralDisplayText={referralDisplayText}
        isReferralReady={isReferralReady}
      />
      <Stack justifyContent="center" alignItems="center" mb="$6">
        <ShareView
          data={data}
          config={config}
          referralQrCodeUrl={referralQrCodeUrl}
          referralDisplayText={referralDisplayText}
          isReferralReady={isReferralReady}
          generatorRef={generatorRef}
        />
      </Stack>
      <ControlPanel
        config={config}
        onChange={setConfig}
        onSaveImage={handleSaveImage}
        onCopyLink={copyLink}
        onShareToX={handleShareToX}
        isLoading={isActionLoading}
        isMobile
      />
    </YStack>
  );

  return isMobile ? mobileLayout : desktopLayout;
}

export function showPositionShareDialog(
  data: IShareData,
  dialog?: ReturnType<typeof useInPageDialog>,
) {
  const DialogInstance =
    platformEnv.isNativeAndroid || !dialog ? Dialog : dialog;

  const dialogInstance = DialogInstance.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perps_share_position_title,
    }),
    floatingPanelProps: platformEnv.isNative
      ? undefined
      : {
          width: 'autoWidth',
        },

    renderContent: (
      <PerpsProviderMirror>
        <ShareContent
          data={data}
          onClose={() => {
            void dialogInstance.close();
          }}
          isMobile={platformEnv.isNative}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
  });

  return dialogInstance;
}
