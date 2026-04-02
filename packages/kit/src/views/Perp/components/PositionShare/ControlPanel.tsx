import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IPnlDisplayMode, IShareConfig } from './types';

interface IControlPanelProps {
  config: IShareConfig;
  onChange: (config: IShareConfig) => void;
  onSaveImage: () => void;
  onShareImage: () => void;
  onCopyLink: () => void;
  onShareToX: () => void;
  isLoading?: boolean;
  isMobile?: boolean;
}

export function ControlPanel({
  config,
  onChange,
  onSaveImage,
  onShareImage,
  onCopyLink,
  onShareToX,
  isLoading,
  isMobile,
}: IControlPanelProps) {
  const intl = useIntl();

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
                  bg="$bgApp"
                  justifyContent="center"
                  cursor="default"
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
            cursor="default"
          />
          <SizableText size="$bodySm" color="$text">
            {intl.formatMessage({
              id: ETranslations.action_save,
            })}
          </SizableText>
        </YStack>
        {isMobile ? (
          <YStack gap="$1" alignItems="center">
            <IconButton
              title={intl.formatMessage({
                id: ETranslations.explore_share,
              })}
              icon="ShareOutline"
              size="large"
              onPress={onShareImage}
              disabled={isLoading}
              iconSize="$6"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$borderSubdued"
              hoverStyle={{ borderColor: '$borderHover' }}
              bg="$bgApp"
              cursor="default"
            />
            <SizableText size="$bodySm" color="$text">
              {intl.formatMessage({
                id: ETranslations.explore_share,
              })}
            </SizableText>
          </YStack>
        ) : null}
        <YStack gap="$1" alignItems="center">
          <IconButton
            title={intl.formatMessage({
              id: ETranslations.perps_share_position_btn_copy_link,
            })}
            icon="LinkOutline"
            size="large"
            onPress={onCopyLink}
            onPressDebounce={500}
            disabled={isLoading}
            iconSize="$6"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$borderSubdued"
            hoverStyle={{ borderColor: '$borderHover' }}
            bg="$bgApp"
            cursor="default"
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
            icon="Xbrand"
            onPress={onShareToX}
            disabled={isLoading}
            iconSize="$6"
            borderRadius="$4"
            borderWidth={1}
            borderColor="$borderSubdued"
            hoverStyle={{ borderColor: '$borderHover' }}
            bg="$bgApp"
            cursor="default"
          />
          <SizableText size="$bodySm" color="$text">
            X
          </SizableText>
        </YStack>
      </XStack>
    </YStack>
  );
}
