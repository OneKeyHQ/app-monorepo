import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BACKGROUNDS } from './constants';

import type { IPnlDisplayMode, IShareConfig, IShareData } from './types';

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
    const pnlBn = new BigNumber(data.pnl || '0');
    return pnlBn.isGreaterThan(0);
  }, [data.pnl]);

  // const availableBackgrounds = useMemo(() => {
  //   const specific = isProfit ? BACKGROUNDS.profit : BACKGROUNDS.loss;
  //   return [...BACKGROUNDS.neutral, ...specific];
  // }, [isProfit]);

  // const handleBackgroundChange = useCallback(
  //   (index: number) => {
  //     onChange({ ...config, backgroundIndex: index });
  //   },
  //   [config, onChange],
  // );

  const handlePnlDisplayModeChange = useCallback(
    (mode: IPnlDisplayMode) => {
      if (config.pnlDisplayMode === mode) return;
      onChange({ ...config, pnlDisplayMode: mode });
    },
    [config, onChange],
  );

  return (
    <YStack flex={1} px={isMobile ? '$4' : undefined}>
      <YStack flex={1} gap="$6">
        {/* <YStack gap="$2">
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
                  <Image source={{ uri: bgSource }} width={72} height={72} />
                </Stack>
              ))}
            </XStack>
          </ScrollView>
        </YStack> */}

        <YStack gap="$2">
          <SizableText size="$headingXs">
            {`${intl.formatMessage({
              id: ETranslations.perp_position_pnl,
            })} / ROE`}
          </SizableText>
          <XStack gap="$3">
            {(['pnl', 'roe'] as IPnlDisplayMode[]).map((mode) => {
              const isActive = config.pnlDisplayMode === mode;
              const label =
                mode === 'roe'
                  ? 'ROE'
                  : intl.formatMessage({
                      id: ETranslations.perp_position_pnl,
                    });
              return (
                <Button
                  key={mode}
                  flexGrow={1}
                  variant={isActive ? 'primary' : 'tertiary'}
                  onPress={() => handlePnlDisplayModeChange(mode)}
                  disabled={isLoading}
                >
                  {label}
                </Button>
              );
            })}
          </XStack>
        </YStack>
      </YStack>

      <YStack gap="$3" mb={isMobile ? '$4' : undefined}>
        <XStack gap="$3">
          <Button
            flexGrow={1}
            icon="DownloadOutline"
            onPress={onSaveImage}
            disabled={isLoading}
          >
            {intl.formatMessage({
              id: ETranslations.perps_share_position_btn_save_img,
            })}
          </Button>
          <Button
            flexGrow={1}
            icon="Copy3Outline"
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
          icon="Xbrand"
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
