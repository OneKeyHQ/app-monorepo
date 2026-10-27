import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  runAfterActionListClose,
  useMedia,
} from '@onekeyhq/components';
import GiftExpandOnDark from '@onekeyhq/kit/assets/animations/gift-expand-on-dark.json';
import GiftExpandOnLight from '@onekeyhq/kit/assets/animations/gift-expand-on-light.json';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import {
  ActivityShortcutCard,
  MENU_SHORTCUT_GRID_PROPS,
} from './ActivityShortcutCard';
import { ActivityHubInvitePanel } from './ActivityHubInvitePanel';
import { ACTIVITY_HUB_SHORTCUT_BASIS } from './layout';

import type {
  IActivityHubCampaign,
  IActivityHubOpenReferral,
  IActivityHubSource,
} from './types';

const EMPTY_ACTIVITY_HUB_CAMPAIGNS: IActivityHubCampaign[] = [];

function ActivityCampaignCard({
  title,
  subtitle,
  imageUrl,
  fallbackIconName = 'GiftOutline',
  variant = 'outlined',
  illustration,
  listLayout = false,
  onPress,
}: {
  title: string;
  subtitle: string;
  imageUrl?: string;
  fallbackIconName?: IButtonProps['icon'];
  variant?: 'filled' | 'outlined';
  illustration?: ReactNode;
  listLayout?: boolean;
  onPress: () => void;
}) {
  const themeVariant = useThemeVariant();
  const filledBackground = themeVariant === 'dark' ? '$bgStrong' : '$bgSubdued';

  if (listLayout) {
    return (
      <ActivityShortcutCard
        title={title}
        subtitle={subtitle}
        iconName={fallbackIconName}
        leadingContent={
          illustration || imageUrl ? (
            <Stack w="$5" h="$5" flexShrink={0}>
              {illustration ?? (
                <Image
                  w="$5"
                  h="$5"
                  src={imageUrl}
                  fallback={
                    <Icon name={fallbackIconName} size="$5" color="$text" />
                  }
                />
              )}
            </Stack>
          ) : undefined
        }
        flexBasis="100%"
        listLayout
        onPress={onPress}
      />
    );
  }

  return (
    <XStack
      onPress={onPress}
      alignItems="center"
      gap="$3"
      px={variant === 'filled' ? '$4' : '$3'}
      py="$2"
      minHeight={variant === 'filled' ? 64 : undefined}
      borderRadius="$4"
      borderWidth={variant === 'filled' ? 0 : '$px'}
      borderColor="$borderSubdued"
      bg={variant === 'filled' ? filledBackground : '$bg'}
      hoverStyle={{ bg: variant === 'filled' ? '$bgStrongHover' : '$bgHover' }}
      pressStyle={{
        bg: variant === 'filled' ? '$bgStrongActive' : '$bgActive',
      }}
      cursor="default"
      userSelect="none"
    >
      <Stack
        alignItems="center"
        justifyContent="center"
        w={illustration ? 56 : '$8'}
        h={illustration ? 50 : '$8'}
        p={illustration ? 2.5 : undefined}
        flexShrink={0}
        borderRadius="$2"
        bg={illustration ? undefined : '$bgSubdued'}
      >
        {illustration ??
          (imageUrl ? (
            <Image
              w="$8"
              h="$8"
              src={imageUrl}
              borderRadius="$2"
              fallback={
                <Icon name={fallbackIconName} size="$6" color="$icon" />
              }
            />
          ) : (
            <Icon name={fallbackIconName} size="$6" color="$iconSubdued" />
          ))}
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
  void runAfterActionListClose(closePopover, action, {
    waitForAnimation: false,
  });
}

// Campaign links are the one action that must not wait for the close: the host
// resolves its close promise from a timer, and web popup blockers only honour
// window.open while the tap still holds user activation. Native keeps the
// close-first order because iOS drops an in-app browser presented on top of a
// sheet that is still dismissing.
function openCampaignUrl(
  closePopover: () => void | Promise<void>,
  url: string,
) {
  if (platformEnv.isNative) {
    closeThenRun(closePopover, () => {
      openUrlExternal(url);
    });
    return;
  }
  void closePopover();
  openUrlExternal(url);
}

export function ActivityHubContent({
  source,
  closePopover,
  showTitle = true,
  menuLayout = false,
  menuPopoverLayout = false,
  campaignFallbackIllustration,
  onOpenReferral,
  campaigns,
}: {
  source: IActivityHubSource;
  closePopover: () => void | Promise<void>;
  showTitle?: boolean;
  menuLayout?: boolean;
  menuPopoverLayout?: boolean;
  campaignFallbackIllustration?: ReactNode;
  onOpenReferral: IActivityHubOpenReferral;
  campaigns?: IActivityHubCampaign[];
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isDesktop = gtMd;
  const themeVariant = useThemeVariant();
  const activityCenterTitle = intl.formatMessage({
    id: ETranslations.perps_activity_hub,
  });
  const campaignItems = campaigns ?? EMPTY_ACTIVITY_HUB_CAMPAIGNS;
  const showIconBackground = menuLayout;
  const horizontalPadding = '$4';
  const topPadding = isDesktop && showTitle ? '$3.5' : '$3';
  const giftAnimation =
    themeVariant === 'light' ? GiftExpandOnLight : GiftExpandOnDark;
  const campaignCount = campaignItems.length;
  const hasCampaigns = campaignCount > 0;
  // Native has no Referral tab, so its hub links to the page; pointer layouts
  // have one in the sidebar and show the code and link to copy instead. The
  // Perps menu lists the entry like its other menu items.
  const showInvitePanel = !platformEnv.isNative && !menuLayout;

  return (
    <YStack mb={menuLayout ? '$0' : '$2'}>
      {isDesktop && showTitle ? (
        <XStack px="$5" pt="$4" pb="$1">
          <SizableText size="$headingMd" color="$text" userSelect="none">
            {activityCenterTitle}
          </SizableText>
        </XStack>
      ) : null}
      <YStack
        px={menuLayout ? '$0' : horizontalPadding}
        pt={menuLayout ? '$0' : topPadding}
        pb={menuLayout ? '$0' : '$3.5'}
      >
        {showInvitePanel ? (
          <ActivityHubInvitePanel
            source={source}
            onOpenReferral={(tab) => {
              closeThenRun(closePopover, () => onOpenReferral(tab));
            }}
          />
        ) : (
          <XStack
            width="100%"
            flexWrap="nowrap"
            {...(menuLayout ? MENU_SHORTCUT_GRID_PROPS : {})}
            {...(menuLayout && menuPopoverLayout
              ? {
                  px: '$2',
                  pt: '$2.5',
                  flexDirection: 'column',
                  flexWrap: 'nowrap',
                  alignItems: 'stretch',
                }
              : {})}
          >
            {/* One entry for both sides of referrals, named like the page it
                opens; the page reopens whichever tab was used last. */}
            <ActivityShortcutCard
              testID="activity-hub-referral"
              flexBasis={
                menuLayout && menuPopoverLayout
                  ? '33.333333%'
                  : ACTIVITY_HUB_SHORTCUT_BASIS
              }
              showIconBackground={showIconBackground}
              menuLayout={menuLayout}
              listLayout={menuLayout && menuPopoverLayout}
              iconName={menuLayout ? 'GiftOutline' : undefined}
              lottieSrc={menuLayout ? undefined : giftAnimation}
              title={intl.formatMessage({
                id: ETranslations.sidebar_refer_a_friend,
              })}
              onPress={() => {
                closeThenRun(closePopover, () => onOpenReferral());
              }}
            />
          </XStack>
        )}
        {hasCampaigns ? (
          <YStack
            gap="$2.5"
            mt={menuLayout ? '$0' : '$4'}
            px={menuLayout ? '$5' : undefined}
            {...(menuLayout && menuPopoverLayout ? { px: '$2' } : {})}
            pb={menuLayout ? '$2' : undefined}
          >
            {menuLayout ? null : (
              <SizableText size="$headingXs" color="$text">
                {`${intl.formatMessage({ id: ETranslations.perps_ongoing_events })} (${campaignCount})`}
              </SizableText>
            )}
            <YStack gap="$2">
              {campaignItems.map((item) => (
                <ActivityCampaignCard
                  key={item.id}
                  variant={source === 'Perps' ? 'filled' : 'outlined'}
                  listLayout={menuLayout && menuPopoverLayout}
                  imageUrl={item.imageUrl}
                  illustration={
                    !item.imageUrl &&
                    (!item.iconName || item.iconName === 'GiftOutline')
                      ? campaignFallbackIllustration
                      : undefined
                  }
                  fallbackIconName={
                    (item.iconName as IButtonProps['icon']) ?? 'GiftOutline'
                  }
                  title={item.title}
                  subtitle={item.subtitle}
                  onPress={() => {
                    openCampaignUrl(closePopover, item.url);
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
