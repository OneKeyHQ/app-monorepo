import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  HeaderIconButton,
  Icon,
  LottieView,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import GiftExpandOnDark from '@onekeyhq/kit/assets/animations/gift-expand-on-dark.json';
import GiftExpandOnLight from '@onekeyhq/kit/assets/animations/gift-expand-on-light.json';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useReferFriends } from '../../../hooks/useReferFriends';
import { useThemeVariant } from '../../../hooks/useThemeVariant';

import { useShowInviteeRewardModal } from './InviteeReward/hooks/useShowInviteeRewardModal';

function ActivityShortcutCard({
  title,
  iconName,
  lottieSrc,
  onPress,
}: {
  title: string;
  iconName?: IButtonProps['icon'];
  lottieSrc?: object;
  onPress: () => void;
}) {
  return (
    <YStack
      flexBasis="25%"
      flexShrink={0}
      minWidth={0}
      borderRadius="$2"
      py="$2.5"
      gap="$1"
      alignItems="center"
      justifyContent="flex-start"
      onPress={onPress}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      cursor="default"
      userSelect="none"
    >
      {iconName ? (
        <Stack w="$6" h="$6" ai="center" jc="center">
          <Icon name={iconName} size="$6" color="$icon" />
        </Stack>
      ) : null}
      {lottieSrc ? (
        <Stack w="$6" h="$6" ai="center" jc="center">
          <LottieView width={32} height={32} source={lottieSrc} />
        </Stack>
      ) : null}
      <SizableText
        size="$bodySmMedium"
        textAlign="center"
        numberOfLines={2}
        color="$textSubdued"
      >
        {title}
      </SizableText>
    </YStack>
  );
}

export function PerpsActivityCenterAction({
  size = 'medium',
  copyAsUrl = false,
}: {
  size?: IButtonProps['size'];
  copyAsUrl?: boolean;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isDesktop = gtMd;
  const themeVariant = useThemeVariant();
  const { shareReferRewards } = useReferFriends();
  const { showInviteeRewardModal } = useShowInviteeRewardModal();
  const activityCenterTitle = '活动中心';

  const handleOpenReferReward = useCallback(() => {
    void shareReferRewards(undefined, undefined, 'Perps', copyAsUrl);
  }, [copyAsUrl, shareReferRewards]);

  const handleOpenTradeReward = useCallback(() => {
    void showInviteeRewardModal();
  }, [showInviteeRewardModal]);

  return (
    <Popover
      title={activityCenterTitle}
      showHeader={!isDesktop}
      placement="bottom-end"
      sheetProps={
        isDesktop
          ? undefined
          : {
              dismissOnSnapToBottom: true,
            }
      }
      floatingPanelProps={{
        width: isDesktop ? 384 : undefined,
      }}
      renderTrigger={
        <HeaderIconButton title={undefined} icon="GiftOutline" size={size} />
      }
      renderContent={({ closePopover }) => (
        <YStack>
          {isDesktop ? (
            <XStack px="$5" pt="$4" pb="$1">
              <SizableText size="$headingMd" color="$text" userSelect="none">
                {activityCenterTitle}
              </SizableText>
            </XStack>
          ) : null}
          <YStack px="$4" py="$3.5">
            <XStack width="100%" flexWrap="nowrap">
              <ActivityShortcutCard
                lottieSrc={
                  themeVariant === 'light'
                    ? GiftExpandOnLight
                    : GiftExpandOnDark
                }
                title={intl.formatMessage({
                  id: ETranslations.sidebar_refer_a_friend,
                })}
                onPress={() => {
                  closePopover();
                  handleOpenReferReward();
                }}
              />
              <ActivityShortcutCard
                iconName="HandCoinsOutline"
                title={intl.formatMessage({
                  id: ETranslations.perps_trade_reward,
                })}
                onPress={() => {
                  closePopover();
                  handleOpenTradeReward();
                }}
              />
            </XStack>
          </YStack>
        </YStack>
      )}
    />
  );
}
