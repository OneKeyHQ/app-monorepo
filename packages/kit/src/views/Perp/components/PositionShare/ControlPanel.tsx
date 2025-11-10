import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Image,
  Input,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BACKGROUNDS, STICKERS } from './constants';

import type { IShareConfig, IShareData } from './types';

interface IControlPanelProps {
  config: IShareConfig;
  data: IShareData;
  onChange: (config: IShareConfig) => void;
  onSaveImage: () => void;
  onCopyLink: () => void;
  onShareToX: () => void;
  isLoading?: boolean;
  isMobile?: boolean;
}

export function ControlPanel({
  config,
  data,
  onChange,
  onSaveImage,
  onCopyLink,
  onShareToX,
  isLoading,
  isMobile,
}: IControlPanelProps) {
  const intl = useIntl();

  const isProfit = useMemo(() => {
    const pnlNum = parseFloat(data.pnl);
    return pnlNum >= 0;
  }, [data.pnl]);

  const availableBackgrounds = useMemo(() => {
    const specific = isProfit ? BACKGROUNDS.profit : BACKGROUNDS.loss;
    return [...BACKGROUNDS.neutral, ...specific];
  }, [isProfit]);

  const handleTextChange = useCallback(
    (text: string) => {
      onChange({ ...config, customText: text });
    },
    [config, onChange],
  );

  const handleBackgroundChange = useCallback(
    (index: number) => {
      onChange({ ...config, backgroundIndex: index });
    },
    [config, onChange],
  );

  const handleStickerChange = useCallback(
    (index: number) => {
      if (config.stickerIndex === index) {
        onChange({ ...config, stickerIndex: null });
      } else {
        onChange({ ...config, stickerIndex: index });
      }
    },
    [config, onChange],
  );

  return (
    <YStack px="$5" flex={1}>
      <YStack flex={1} gap="$6">
        <YStack gap="$2">
          <SizableText size="$headingXs">
            {intl.formatMessage({
              id: ETranslations.perps_share_position_background,
            })}
          </SizableText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$3">
              {availableBackgrounds.map((bgSource, index) => (
                <Stack
                  key={index}
                  width={72}
                  height={72}
                  borderRadius="$3"
                  borderWidth="$0.5"
                  borderColor={
                    config.backgroundIndex === index
                      ? '$borderActive'
                      : '$borderSubdued'
                  }
                  justifyContent="center"
                  alignItems="center"
                  overflow="hidden"
                  cursor="pointer"
                  hoverStyle={{ borderColor: '$borderHover' }}
                  pressStyle={{ opacity: 0.8 }}
                  onPress={() => handleBackgroundChange(index)}
                >
                  <Image source={bgSource} width={72} height={72} />
                </Stack>
              ))}
            </XStack>
          </ScrollView>
        </YStack>
      </YStack>

      <YStack gap="$3" mb={isMobile ? '$4' : undefined}>
        <XStack gap="$3">
          <Button
            flex={1}
            icon="DownloadOutline"
            onPress={onSaveImage}
            disabled={isLoading}
          >
            {intl.formatMessage({
              id: ETranslations.perps_share_position_btn_save_img,
            })}
          </Button>
          <Button
            flex={1}
            icon="CopyOutline"
            onPress={onCopyLink}
            disabled={isLoading}
          >
            {intl.formatMessage({
              id: ETranslations.perps_share_position_btn_copy_link,
            })}
          </Button>
        </XStack>
        <Button
          variant="primary"
          icon="XBrand"
          onPress={onShareToX}
          disabled={isLoading}
        >
          {intl.formatMessage({
            id: ETranslations.perps_share_position_btn_Share_on_x,
          })}
        </Button>
      </YStack>
    </YStack>
  );
}
