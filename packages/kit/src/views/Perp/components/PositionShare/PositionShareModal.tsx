import { useCallback, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import type { useInPageDialog } from '@onekeyhq/components';
import {
  Dialog,
  Page,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { DEFAULT_PNL_DISPLAY_MODE, getDefaultShareText } from './constants';
import { ControlPanel } from './ControlPanel';
import { ShareImageGenerator } from './ShareImageGenerator';
import { ShareView } from './ShareView';
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
  const { side, token } = data;

  const [config, setConfig] = useState<IShareConfig>({
    customText: getDefaultShareText(side, token),
    stickerIndex: null,
    backgroundIndex: 0,
    pnlDisplayMode: DEFAULT_PNL_DISPLAY_MODE,
  });

  const { saveImage, copyLink, shareToX } = useShareActions();
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
    <XStack gap="$5">
      <ShareImageGenerator ref={generatorRef} data={data} config={config} />
      <Stack justifyContent="center" alignItems="center">
        <ShareView
          data={data}
          config={config}
          scale={0.5}
          generatorRef={generatorRef}
        />
      </Stack>
      <Stack maxWidth={380}>
        <ControlPanel
          config={config}
          data={data}
          onChange={setConfig}
          onSaveImage={handleSaveImage}
          onCopyLink={copyLink}
          onShareToX={handleShareToX}
          isLoading={isActionLoading}
        />
      </Stack>
    </XStack>
  );

  const mobileLayout = (
    <YStack width="100%" flex={1}>
      <ShareImageGenerator ref={generatorRef} data={data} config={config} />
      <Stack justifyContent="center" alignItems="center" mb="$6">
        <ShareView data={data} config={config} generatorRef={generatorRef} />
      </Stack>
      <YStack flex={1}>
        <ControlPanel
          config={config}
          data={data}
          onChange={setConfig}
          onSaveImage={handleSaveImage}
          onCopyLink={copyLink}
          onShareToX={handleShareToX}
          isLoading={isActionLoading}
          isMobile
        />
      </YStack>
    </YStack>
  );

  return isMobile ? mobileLayout : desktopLayout;
}

function MobilePositionShareModal({
  route,
}: {
  route: { params: { data: IShareData } };
}) {
  const navigation = useNavigation();
  const { data } = route.params;
  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <Page>
      <Page.Header
        title={appLocale.intl.formatMessage({
          id: ETranslations.perps_share_position_title,
        })}
      />
      <Page.Body>
        <PerpsProviderMirror>
          <YStack px="$2" flex={1}>
            <ShareContent data={data} onClose={handleClose} isMobile />
          </YStack>
        </PerpsProviderMirror>
      </Page.Body>
    </Page>
  );
}

export default MobilePositionShareModal;

export function showPositionShareDialog(
  data: IShareData,
  dialog?: ReturnType<typeof useInPageDialog>,
) {
  const DialogInstance = dialog || Dialog;

  const dialogInstance = DialogInstance.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.perps_share_position_title,
    }),
    floatingPanelProps: platformEnv.isNative
      ? undefined
      : {
          width: 'autoWidth',
        },
    contentContainerProps: {
      px: '$5',
      pb: '$6',
    },
    renderContent: (
      <PerpsProviderMirror>
        <ShareContent
          data={data}
          onClose={() => {
            void dialogInstance.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: false,
  });

  return dialogInstance;
}
