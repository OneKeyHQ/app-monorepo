import { useCallback, useMemo } from 'react';

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
          <SizableText size="$headingXs">Background</SizableText>
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

      <YStack gap="$3" mb={isMobile ? '$6' : undefined}>
        <XStack gap="$3">
          <Button
            flex={1}
            icon="DownloadOutline"
            onPress={onSaveImage}
            disabled={isLoading}
          >
            Save Image
          </Button>
          <Button
            flex={1}
            icon="CopyOutline"
            onPress={onCopyLink}
            disabled={isLoading}
          >
            Copy Link
          </Button>
        </XStack>
        <Button
          variant="primary"
          icon="XBrand"
          onPress={onShareToX}
          disabled={isLoading}
        >
          Share on X
        </Button>
      </YStack>
    </YStack>
  );
}
