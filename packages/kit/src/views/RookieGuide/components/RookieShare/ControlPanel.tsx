import { useIntl } from 'react-intl';

import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IControlPanelProps {
  onSaveImage: () => void;
  onShareImage: () => void;
  onCopyLink: () => void;
  onShareToX: () => void;
  isLoading?: boolean;
  isMobile?: boolean;
  hasReferralUrl?: boolean;
}

export function ControlPanel({
  onSaveImage,
  onShareImage,
  onCopyLink,
  onShareToX,
  isLoading,
  isMobile,
  hasReferralUrl,
}: IControlPanelProps) {
  const intl = useIntl();

  return (
    <XStack
      gap="$6"
      mb={isMobile ? '$4' : undefined}
      alignItems="center"
      justifyContent="center"
    >
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

      {isMobile ? (
        <YStack gap="$1" alignItems="center">
          <IconButton
            title={intl.formatMessage({
              id: ETranslations.explore_share,
            })}
            cursor="pointer"
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
          />
          <SizableText size="$bodySm" color="$text">
            {intl.formatMessage({
              id: ETranslations.explore_share,
            })}
          </SizableText>
        </YStack>
      ) : null}

      {hasReferralUrl ? (
        <YStack gap="$1" alignItems="center">
          <IconButton
            title={intl.formatMessage({
              id: ETranslations.perps_share_position_btn_copy_link,
            })}
            cursor="pointer"
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
          />
          <SizableText size="$bodySm" color="$text">
            {intl.formatMessage({
              id: ETranslations.address_book_menu_copy,
            })}
          </SizableText>
        </YStack>
      ) : null}

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
  );
}
