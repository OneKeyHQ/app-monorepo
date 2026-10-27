import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useOneKeyAuthMethods } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ReferralTabCrossLink } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/ReferralTabCrossLink';
import { useReferralTabCopy } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/referralTabCopy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { buildReferralUrl } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IReferralPageTab } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IActivityHubSource } from './types';

const SUMMARY_TIMEOUT_MS = 5000;

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

function CopyField({
  label,
  value,
  testID,
}: {
  label: string;
  value?: string;
  testID: string;
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  return (
    <YStack gap="$1.5">
      <SizableText size="$bodyMdMedium">{label}</SizableText>
      <XStack
        gap="$3"
        bg="$bgStrong"
        borderRadius="$2"
        px="$2"
        py="$1.5"
        jc="space-between"
        ai="center"
      >
        {value ? (
          <SizableText size="$bodyLgMedium" numberOfLines={1} flexShrink={1}>
            {value}
          </SizableText>
        ) : (
          <Skeleton width={120} height={20} />
        )}
        <IconButton
          testID={testID}
          title={intl.formatMessage({ id: ETranslations.global_copy })}
          variant="tertiary"
          icon="Copy3Outline"
          size="small"
          iconColor="$iconSubdued"
          flexShrink={0}
          disabled={!value}
          onPress={() => {
            if (!value) {
              return;
            }
            copyText(value);
            defaultLogger.referral.page.copyReferralCode();
          }}
        />
      </XStack>
    </YStack>
  );
}

// Pointer layouts already list Referral in the sidebar, so their gift opens
// what the sidebar cannot: the code and link to copy on the spot, plus a way
// to the Perks tab for people who joined with someone else's code. Signed
// out, Join opens the referral intro, which carries the sign-in.
export function ActivityHubInvitePanel({
  source,
  onOpenReferral,
}: {
  source: IActivityHubSource;
  onOpenReferral: (tab: IReferralPageTab) => void;
}) {
  const intl = useIntl();
  const tabCopy = useReferralTabCopy();
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

  return (
    <YStack gap="$3">
      {isLoggedIn ? (
        <>
          <CopyField
            testID="activity-hub-copy-code"
            label={intl.formatMessage({ id: ETranslations.referral_your_code })}
            value={code}
          />
          <CopyField
            testID="activity-hub-copy-link"
            label={intl.formatMessage({
              id: ETranslations.referral_referral_link,
            })}
            value={url}
          />
        </>
      ) : (
        <YStack gap="$3">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.referral_home__title })}
          </SizableText>
          <Button
            testID="activity-hub-join"
            variant="primary"
            onPress={() => onOpenReferral('invite')}
          >
            {intl.formatMessage({ id: ETranslations.global_join })}
          </Button>
        </YStack>
      )}
      <ReferralTabCrossLink
        testID="activity-hub-open-perks"
        px="$0"
        pt="$3"
        prompt={tabCopy.toPerksPrompt}
        action={tabCopy.toPerksAction}
        onPress={() => onOpenReferral('benefits')}
      />
    </YStack>
  );
}
