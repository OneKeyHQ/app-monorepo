import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  INVITE_CARD_BORDER_COLOR,
  PRESSABLE_SURFACE_PROPS,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
import { useReferralTabCopy } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/referralTabCopy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { buildReferralUrl } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IActivityHubAction } from '@onekeyhq/shared/src/logger/scopes/referral/scenes/activityHub';
import type { IReferralPageTab } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IActivityHubSource } from './types';

const SUMMARY_TIMEOUT_MS = 5000;

// Named like the products on the referral page, so the badge says whose
// landing page the link opens.
const SOURCE_PRODUCT_TITLE: Record<IActivityHubSource, ETranslations> = {
  Earn: ETranslations.referral_referred_type_2,
  Perps: ETranslations.perps_perps,
  Swap: ETranslations.global_swap,
};

// The summary holds the current code; a slow or failed request falls back to
// the code cached from the last summary.
async function fetchMyReferralCode() {
  try {
    const summary = await timerUtils.timeout(
      backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
      SUMMARY_TIMEOUT_MS,
    );
    return summary.inviteCode || '';
  } catch {
    return backgroundApiProxy.serviceReferralCode.getMyReferralCode();
  }
}

// Pointer layouts already list Referral in the sidebar, so their gift opens
// what the sidebar cannot: the link and code to copy on the spot, laid out
// like the invite card on the referral page, plus the Perks tab, named and
// described as in the referral page's tab switch. Signed out, Join opens the
// referral intro, which carries the sign-in.
export function ActivityHubInvitePanel({
  source,
  onOpenReferral,
}: {
  source: IActivityHubSource;
  onOpenReferral: (tab: IReferralPageTab) => void;
}) {
  const intl = useIntl();
  const tabCopy = useReferralTabCopy();
  const { copyText } = useClipboard();
  const { isLoggedIn } = useOneKeyAuthMethods();
  const [devSettings] = useDevSettingsPersistAtom();
  const env =
    devSettings.enabled && devSettings.settings?.enableTestEndpoint
      ? 'test'
      : 'prod';
  const { result: code } = usePromiseResult(
    async () => (isLoggedIn ? fetchMyReferralCode() : ''),
    [isLoggedIn],
  );
  // Links land on the product the user shared from.
  const url = useMemo(
    () => (code ? buildReferralUrl({ code, source, env }) : undefined),
    [code, env, source],
  );
  const logAction = (action: IActivityHubAction) =>
    defaultLogger.referral.activityHub.activityHubActionPressed({
      source,
      action,
    });

  const copyLink = () => {
    if (!url) {
      return;
    }
    copyText(url);
    defaultLogger.referral.page.shareReferralLink('copy');
    logAction('copy_link');
  };
  const copyCode = () => {
    if (!code) {
      return;
    }
    copyText(code);
    defaultLogger.referral.page.copyReferralCode();
    logAction('copy_code');
  };

  return (
    <YStack gap="$3">
      {isLoggedIn ? (
        <YStack gap="$2">
          <XStack ai="center" jc="space-between" gap="$2">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.referral_referral_link,
              })}
            </SizableText>
            <Badge badgeSize="sm">
              {intl.formatMessage({ id: SOURCE_PRODUCT_TITLE[source] })}
            </Badge>
          </XStack>
          {/* The link and its Copy button read as one pill, like the invite
              card's link field; the button sits 8px from every edge. */}
          <XStack
            minHeight={44}
            ai="center"
            gap="$2"
            pl="$4"
            pr="$2"
            borderRadius="$full"
            bg="$bgStrong"
          >
            {url ? (
              <SizableText
                flex={1}
                minWidth={0}
                size="$bodyLg"
                numberOfLines={1}
              >
                {url}
              </SizableText>
            ) : (
              <YStack flex={1}>
                <Skeleton width={160} height={16} />
              </YStack>
            )}
            <Button
              testID="activity-hub-copy-link"
              variant="primary"
              size="small"
              disabled={!url}
              onPress={copyLink}
            >
              {intl.formatMessage({
                id: ETranslations.referral_copy_link__action,
              })}
            </Button>
          </XStack>
          {/* A tap anywhere on the code row copies it; the icon is the cue. */}
          <XStack
            testID="activity-hub-copy-code"
            ai="center"
            jc="space-between"
            gap="$3"
            mx="$-2"
            px="$2"
            py="$1.5"
            borderRadius="$2"
            {...PRESSABLE_SURFACE_PROPS}
            onPress={copyCode}
          >
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.referral_your_code })}
            </SizableText>
            <XStack ai="center" gap="$1.5" minWidth={0}>
              {code ? (
                <SizableText
                  size="$bodyMdMedium"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {code}
                </SizableText>
              ) : (
                <Skeleton width={64} height={16} />
              )}
              <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
            </XStack>
          </XStack>
        </YStack>
      ) : (
        <Button
          testID="activity-hub-join"
          variant="primary"
          onPress={() => {
            logAction('join');
            onOpenReferral('invite');
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_join })}
        </Button>
      )}
      <Divider borderColor={INVITE_CARD_BORDER_COLOR} />
      <XStack
        testID="activity-hub-open-perks"
        ai="center"
        gap="$3"
        mx="$-2"
        px="$2"
        py="$1.5"
        borderRadius="$2"
        {...PRESSABLE_SURFACE_PROPS}
        onPress={() => {
          logAction('open_perks');
          onOpenReferral('benefits');
        }}
      >
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.referral_perks__title })}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {tabCopy.perksIntro}
          </SizableText>
        </YStack>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    </YStack>
  );
}
