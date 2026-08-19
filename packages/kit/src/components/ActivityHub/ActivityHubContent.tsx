import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Icon,
  Image,
  LottieView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import GiftExpandOnDark from '@onekeyhq/kit/assets/animations/gift-expand-on-dark.json';
import GiftExpandOnLight from '@onekeyhq/kit/assets/animations/gift-expand-on-light.json';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { getActivityHubLayout } from './layout';

import type { IActivityHubShortcutBasis } from './layout';
import type { IActivityHubCampaign, IActivityHubSource } from './types';

const EMPTY_ACTIVITY_HUB_CAMPAIGNS: IActivityHubCampaign[] = [];

function ActivityShortcutCard({
  title,
  iconName,
  lottieSrc,
  flexBasis,
  testID,
  onPress,
}: {
  title: string;
  iconName?: IButtonProps['icon'];
  lottieSrc?: object;
  flexBasis: IActivityHubShortcutBasis;
  testID?: string;
  onPress: () => void;
}) {
  return (
    <YStack
      testID={testID}
      flexBasis={flexBasis}
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

// The hub lives in a popover on the tab headers and in a dialog inside Swap
// settings. Closing a dialog is async, and on native a screen pushed before the
// sheet finishes closing ends up behind the overlay, so always let the host
// close first.
function closeThenRun(
  closePopover: () => void | Promise<void>,
  action: () => void,
) {
  void (async () => {
    await closePopover();
    action();
  })();
}

export function ActivityHubContent({
  source,
  copyAsUrl = false,
  closePopover,
  showTitle = true,
  isCompactPanel = false,
  onOpenInviteeReward,
  campaigns,
}: {
  source: IActivityHubSource;
  copyAsUrl?: boolean;
  closePopover: () => void | Promise<void>;
  showTitle?: boolean;
  // True only for a 208px floating popover/dialog. Sheets and in-panel embeds
  // leave this unset so tiles keep the 25% basis.
  isCompactPanel?: boolean;
  onOpenInviteeReward: () => void;
  campaigns?: IActivityHubCampaign[];
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isDesktop = gtMd;
  const themeVariant = useThemeVariant();
  const { shareReferRewards } = useReferFriends();
  const activityCenterTitle = intl.formatMessage({
    id: ETranslations.perps_activity_hub,
  });
  const campaignItems = campaigns ?? EMPTY_ACTIVITY_HUB_CAMPAIGNS;
  const hasCampaigns = campaignItems.length > 0;
  // Campaigns still force the 4-column row. Compact is an explicit host signal,
  // not gtMd: native popovers are sheets and Perps embeds sit in a wide panel.
  const { shortcutBasis } = getActivityHubLayout(
    hasCampaigns || !isCompactPanel,
  );

  return (
    <YStack mb="$2">
      {isDesktop && showTitle ? (
        <XStack px="$5" pt="$4" pb="$1">
          <SizableText size="$headingMd" color="$text" userSelect="none">
            {activityCenterTitle}
          </SizableText>
        </XStack>
      ) : null}
      <YStack px="$4" pt={isDesktop && showTitle ? '$3.5' : '$3'} pb="$3.5">
        <XStack width="100%" flexWrap="nowrap">
          <ActivityShortcutCard
            testID="activity-hub-invite"
            flexBasis={shortcutBasis}
            lottieSrc={
              themeVariant === 'light' ? GiftExpandOnLight : GiftExpandOnDark
            }
            title={intl.formatMessage({
              id: ETranslations.activity_hub_invite__action,
            })}
            onPress={() => {
              closeThenRun(closePopover, () => {
                void shareReferRewards(undefined, undefined, source, copyAsUrl);
              });
            }}
          />
          <ActivityShortcutCard
            testID="activity-hub-my-rewards"
            flexBasis={shortcutBasis}
            iconName="HandCoinsOutline"
            title={intl.formatMessage({
              id: ETranslations.activity_hub_my_rewards__action,
            })}
            onPress={() => {
              closeThenRun(closePopover, onOpenInviteeReward);
            }}
          />
        </XStack>
        {hasCampaigns ? (
          <YStack gap="$2.5" mt="$4">
            <SizableText size="$headingXs" color="$text">
              {`${intl.formatMessage({ id: ETranslations.perps_ongoing_events })} (${campaignItems.length})`}
            </SizableText>
            <YStack gap="$2">
              {campaignItems.map((item) => (
                <ActivityCampaignCard
                  key={item.id}
                  imageUrl={item.imageUrl}
                  fallbackIconName={
                    (item.iconName as IButtonProps['icon']) ?? 'GiftOutline'
                  }
                  title={item.title}
                  subtitle={item.subtitle}
                  onPress={() => {
                    closeThenRun(closePopover, () => {
                      void openUrlExternal(item.url);
                    });
                  }}
                />
              ))}
            </YStack>
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  );
}
