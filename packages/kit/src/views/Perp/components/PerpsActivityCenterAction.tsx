import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  HeaderIconButton,
  Icon,
  Image,
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
import { usePerpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

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

function ActivityCampaignCard({
  title,
  subtitle,
  imageUrl,
  fallbackIconName = 'GiftOutline',
  onPress,
}: {
  title: string;
  subtitle: string;
  imageUrl?: string;
  fallbackIconName?: IButtonProps['icon'];
  onPress: () => void;
}) {
  return (
    <XStack
      onPress={onPress}
      alignItems="center"
      gap="$3"
      px="$3"
      py="$2"
      borderRadius="$4"
      borderWidth="$px"
      borderColor="$borderSubdued"
      bg="$bg"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      cursor="default"
      userSelect="none"
    >
      <Stack
        alignItems="center"
        justifyContent="center"
        w="$8"
        h="$8"
        borderRadius="$2"
        bg="$bgSubdued"
      >
        {imageUrl ? (
          <Image
            w="$8"
            h="$8"
            src={imageUrl}
            borderRadius="$2"
            fallback={<Icon name={fallbackIconName} size="$6" color="$icon" />}
          />
        ) : (
          <Icon name={fallbackIconName} size="$6" color="$iconSubdued" />
        )}
      </Stack>
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText size="$headingSm" color="$text" numberOfLines={1}>
          {title}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {subtitle}
        </SizableText>
      </YStack>
      <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
    </XStack>
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
  const [{ perpConfigCommon }] = usePerpsCommonConfigPersistAtom();
  const activityCards = useMemo(
    () => perpConfigCommon?.activityCards ?? [],
    [perpConfigCommon?.activityCards],
  );
  const activityCenterTitle = intl.formatMessage({
    id: ETranslations.perps_activity_hub,
  });
  const hasActivityCards = activityCards.length > 0;

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
        <YStack mb="$2">
          {isDesktop ? (
            <XStack px="$5" pt="$4" pb="$1">
              <SizableText size="$headingMd" color="$text" userSelect="none">
                {activityCenterTitle}
              </SizableText>
            </XStack>
          ) : null}
          <YStack px="$4" pt={isDesktop ? '$3.5' : null} pb="$3.5">
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
            {hasActivityCards ? (
              <YStack gap="$2.5" mt="$4">
                <SizableText size="$headingXs" color="$text">
                  {`${intl.formatMessage({ id: ETranslations.perps_ongoing_events })} (${activityCards.length})`}
                </SizableText>
                <YStack gap="$2">
                  {activityCards.map((item) => (
                    <ActivityCampaignCard
                      key={item.id}
                      imageUrl={item.imageUrl}
                      fallbackIconName={
                        (item.iconName as IButtonProps['icon']) ?? 'GiftOutline'
                      }
                      title={item.title}
                      subtitle={item.subtitle}
                      onPress={() => {
                        closePopover();
                        void openUrlExternal(item.url);
                      }}
                    />
                  ))}
                </YStack>
              </YStack>
            ) : null}
          </YStack>
        </YStack>
      )}
    />
  );
}
