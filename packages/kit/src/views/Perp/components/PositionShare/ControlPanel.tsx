import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  IconButton,
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
    <YStack flex={1} px={isMobile ? 10 : undefined} gap="$5">
      <YStack flex={1} gap="$11">
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
          <SizableText size="$headingXs" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.perp_share_select_information,
            })}
          </SizableText>
          <XStack gap="$5">
            {(['pnl', 'roe'] as IPnlDisplayMode[]).map((mode) => {
              const isActive = config.pnlDisplayMode === mode;
              const label =
                mode === 'roe'
                  ? intl.formatMessage({
                      id: ETranslations.perp_share_roe,
                    })
                  : intl.formatMessage({
                      id: ETranslations.perp_share_pnl,
                    });
              return (
                <Badge
                  key={mode}
                  onPress={() => handlePnlDisplayModeChange(mode)}
                  disabled={isLoading}
                  borderRadius="$2"
                  borderWidth={1}
                  borderColor={isActive ? '$borderActive' : '$borderSubdued'}
                  px="$7"
                  py="$2"
                  alignItems="center"
                  cursor="pointer"
                  bg="$bgApp"
                  justifyContent="center"
                >
                  <Badge.Text size="$bodySmMedium" color="$text">
                    {label}
                  </Badge.Text>
                </Badge>
              );
            })}
          </XStack>
        </YStack>
      </YStack>

      <XStack gap="$6" mb={isMobile ? '$4' : undefined} alignItems="center">
        <YStack gap="$1" alignItems="center">
          <IconButton
            title={intl.formatMessage({
              id: ETranslations.perps_share_position_btn_save_img,
            })}
            cursor="pointer"
            icon="DownloadOutline"
            size="large"
            onPress={onSaveImage}
            disabled={isLoading}
            iconSize="$6"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$borderSubdued"
            hoverStyle={{ borderColor: '$borderHover' }}
            bg="$bgApp"
          />
          <SizableText size="$bodySm" color="$text">
            {intl.formatMessage({
              id: ETranslations.action_save,
            })}
          </SizableText>
        </YStack>
        <YStack gap="$1" alignItems="center">
          <IconButton
            title={intl.formatMessage({
              id: ETranslations.perps_share_position_btn_copy_link,
            })}
            cursor="pointer"
            icon="LinkOutline"
            size="large"
            onPress={onCopyLink}
            disabled={isLoading}
            iconSize="$6"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$borderSubdued"
            hoverStyle={{ borderColor: '$borderHover' }}
            bg="$bgApp"
          />
          <SizableText size="$bodySm" color="$text">
            {intl.formatMessage({
              id: ETranslations.address_book_menu_copy,
            })}
          </SizableText>
        </YStack>
        <YStack gap="$1" alignItems="center">
          <IconButton
            title={intl.formatMessage({
              id: ETranslations.perps_share_position_btn_Share_on_x,
            })}
            size="large"
            cursor="pointer"
            icon="Xbrand"
            onPress={onShareToX}
            disabled={isLoading}
            iconSize="$6"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$borderSubdued"
            hoverStyle={{ borderColor: '$borderHover' }}
            bg="$bgApp"
          />
          <SizableText size="$bodySm" color="$text">
            X
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
}
