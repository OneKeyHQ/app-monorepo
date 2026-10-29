import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Empty,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useReferralCodeCard } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralCodeCard/hooks/useReferralCodeCard';
import { getProductReferralLink } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared/referralLinks';
import { useReferralWebAppUrl } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/shared/useReferralWebAppUrl';
import {
  INVITE_CARD_BORDER_COLOR,
  POINTER_ROW_BLEED_PROPS,
  PRESSABLE_SURFACE_PROPS,
} from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/useInviteCardStyle';
import { useReferralTabCopy } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/referralTabCopy';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IActivityHubAction } from '@onekeyhq/shared/src/logger/scopes/referral/scenes/activityHub';
import type { IReferralPageTab } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IActivityHubSource } from './types';

// A tappable row that bleeds 8px past the text, like the referral page's
// press surfaces, so its text lines up with the rest of the panel.
const PANEL_ROW_PROPS = {
  ...POINTER_ROW_BLEED_PROPS,
  ...PRESSABLE_SURFACE_PROPS,
  ai: 'center',
  gap: '$3',
  py: '$1.5',
  borderRadius: '$2',
} as const;

const SIGNED_OUT_INVITE_TITLE = {
  Perps: ETranslations.referral_link_perps_desc,
  Swap: ETranslations.swap_referral_link__desc,
  Earn: ETranslations.referral_link_defi_desc,
} as const;

function SignedOutInviteGuide({ source }: { source: IActivityHubSource }) {
  const intl = useIntl();

  return (
    <Empty
      testID="activity-hub-signed-out-guide"
      p="$0"
      pb="$1"
      illustration="ShakeHands"
      illustrationProps={{ size: 80, mb: '$1' }}
      title={intl.formatMessage({ id: SIGNED_OUT_INVITE_TITLE[source] })}
      titleProps={{ size: '$bodyLgMedium', mb: '$1' }}
      description={intl.formatMessage({
        id: ETranslations.referral_intro_for_you_2,
      })}
      descriptionProps={{ size: '$bodySm' }}
    />
  );
}

// Pointer layouts already list Referral in the sidebar, so their gift opens
// what the sidebar cannot: the link and code to copy on the spot, laid out
// like the invite card on the referral page, plus the Perks tab, named and
// described as in the referral page's tab switch. Join signs in without
// leaving the panel; the account atom then reveals the code and link.
export function ActivityHubInvitePanel({
  source,
  onOpenReferral,
}: {
  source: IActivityHubSource;
  onOpenReferral: (tab: IReferralPageTab) => void;
}) {
  const intl = useIntl();
  const tabCopy = useReferralTabCopy();
  const { loginOneKeyId } = useOneKeyAuth();
  const [user] = usePrimePersistAtom();
  const isLoggedIn = Boolean(user.isLoggedIn && user.isLoggedInOnServer);
  const onekeyUserId = isLoggedIn ? user.onekeyUserId : undefined;
  const webAppUrl = useReferralWebAppUrl();
  const {
    result: referralCode,
    isLoading,
    run: refreshCode,
  } = usePromiseResult(
    async () => {
      if (!onekeyUserId) {
        return undefined;
      }
      try {
        const summary = await timerUtils.timeout(
          backgroundApiProxy.serviceReferralCode.getSummaryInfo(),
          5000,
        );
        return { onekeyUserId, code: summary.inviteCode || '' };
      } catch (error) {
        // Keep offline copying available without starting another refresh.
        const cachedCode =
          await backgroundApiProxy.serviceReferralCode.getCachedMyReferralCode({
            onekeyUserId,
          });
        if (cachedCode) {
          return { onekeyUserId, code: cachedCode };
        }
        throw error;
      }
    },
    [onekeyUserId],
    {
      watchLoading: true,
      keepResultIfError: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  // A retained result must not remain copyable during an account switch.
  const code =
    onekeyUserId && referralCode?.onekeyUserId === onekeyUserId
      ? referralCode.code
      : undefined;
  // The same product link, and the same line about it, as the referral
  // page's link menu.
  const link = useMemo(
    () =>
      code
        ? getProductReferralLink({ source, inviteCode: code, webAppUrl })
        : undefined,
    [code, source, webAppUrl],
  );
  const { handleCopy, copyLink, inviteCodeUrl } = useReferralCodeCard({
    inviteUrl: link?.url ?? '',
    inviteCode: code ?? '',
  });
  const logAction = (action: IActivityHubAction) =>
    defaultLogger.referral.activityHub.activityHubActionPressed({
      source,
      action,
    });
  const showCodeRetry = isLoading === false && !code;

  return (
    <YStack gap="$3">
      {isLoggedIn && showCodeRetry ? (
        <Button
          testID="activity-hub-retry"
          onPress={() => {
            void refreshCode();
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      ) : null}
      {isLoggedIn && !showCodeRetry ? (
        <YStack gap="$2">
          <XStack ai="center" jc="space-between" gap="$2">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.referral_referral_link,
              })}
            </SizableText>
            {link ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
                flexShrink={1}
              >
                {intl.formatMessage({ id: link.descId })}
              </SizableText>
            ) : null}
          </XStack>
          {/* The link and its Copy button read as one pill, like the invite
              card's link field; the button sits 4px from every edge. */}
          <XStack
            minHeight={36}
            ai="center"
            gap="$2"
            pl="$3"
            pr="$1"
            borderRadius="$full"
            bg="$bgStrong"
          >
            {link ? (
              <SizableText
                flex={1}
                minWidth={0}
                size="$bodyMd"
                numberOfLines={1}
              >
                {inviteCodeUrl}
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
              disabled={!link}
              onPress={() => {
                copyLink();
                logAction('copy_link');
              }}
            >
              {intl.formatMessage({
                id: ETranslations.referral_copy_link__action,
              })}
            </Button>
          </XStack>
          {/* A tap anywhere on the code row copies it; the icon is the cue. */}
          <XStack
            testID="activity-hub-copy-code"
            {...PANEL_ROW_PROPS}
            jc="space-between"
            onPress={() => {
              if (!code) {
                return;
              }
              handleCopy();
              logAction('copy_code');
            }}
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
      ) : null}
      {!isLoggedIn ? (
        <>
          <SignedOutInviteGuide source={source} />
          <Button
            testID="activity-hub-join"
            variant="primary"
            onPressLoadingEnabled
            onPress={async () => {
              logAction('join');
              try {
                await loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: false });
              } catch (error) {
                if (!(error instanceof PrimeLoginDialogCancelError)) {
                  throw error;
                }
              }
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_sign_in })}
          </Button>
        </>
      ) : null}
      <Divider borderColor={INVITE_CARD_BORDER_COLOR} />
      <XStack
        testID="activity-hub-open-perks"
        {...PANEL_ROW_PROPS}
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
