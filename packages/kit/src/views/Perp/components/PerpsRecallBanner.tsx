import { useEffect, useState } from 'react';

import {
  Alert,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  onVisibilityStateChange,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { showPerpsActivityCenterDialog } from './PerpsActivityCenterAction';
import { showPerpsRecallDialog } from './PerpsRecallDialog';
import { PerpsRecallIllustration } from './PerpsRecallIllustration';
import { formatRecallAmount } from './PerpsRecallProgressCard';

export function PerpsRecallBanner() {
  const { gtMd } = useMedia();
  const { progress, hasEnded, instanceId, refresh } = usePerpsRecallProgress();
  const [localSnooze, setLocalSnooze] = useState<{
    key: string;
    until: number;
  }>();
  const [now, setNow] = useState(Date.now);
  const { result: snoozedBanners, run: refreshSnoozedBanners } =
    usePromiseResult(
      () => backgroundApiProxy.serviceWalletBanner.getSnoozedBanners(),
      [],
      {
        undefinedResultIfError: true,
        pollingInterval: timerUtils.getTimeDurationMs({ minute: 1 }),
        revalidateOnFocus: true,
      },
    );
  const dismissKey = progress
    ? `perps-recall:${instanceId}:${progress.activityId}`
    : '';
  const snoozedUntil = Math.max(
    snoozedBanners?.[dismissKey] ?? 0,
    localSnooze?.key === dismissKey ? localSnooze.until : 0,
  );
  useEffect(() => {
    if (snoozedUntil <= now) return;
    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.min(
        Math.max(snoozedUntil - Date.now(), 0),
        timerUtils.getTimeDurationMs({ day: 7 }),
      ),
    );
    return () => clearTimeout(timeout);
  }, [now, snoozedUntil]);
  useEffect(
    () =>
      onVisibilityStateChange((visible) => {
        if (visible) {
          setNow(Date.now());
          void refreshSnoozedBanners();
        }
      }),
    [refreshSnoozedBanners],
  );
  const visible = progress && snoozedBanners && snoozedUntil <= now;

  let bannerText = '';
  if (progress?.payoutStatus === 'paid') {
    bannerText =
      progress.paidAmount !== null
        ? `You’ve received ${formatRecallAmount(progress.paidAmount)} USDC in comeback rewards.`
        : 'Your comeback reward has been sent.';
  } else if (progress?.payoutStatus === 'skipped') {
    bannerText = 'Comeback reward update · View activity details';
  } else if (progress?.status === 'achieved') {
    bannerText = `Target reached! ${formatRecallAmount(progress.earnedReward)} USDC reward awaiting payout.`;
  } else if (hasEnded && progress) {
    bannerText =
      progress.activityStatus === 'ended'
        ? 'Comeback activity ended · View your results'
        : 'Activity ended · Awaiting final results';
  } else if (progress?.current) {
    bannerText = `Trade ${formatRecallAmount(progress.current.remaining)} USDC more to earn ${formatRecallAmount(progress.totalReward)} USDC in rewards.`;
  }
  if (!visible) return null;

  return (
    <YStack mx="$4" mb="$4">
      <Alert
        type="default"
        renderTitle={(titleProps) => (
          <XStack alignItems="center" gap="$3">
            <Stack
              width={48}
              height={44}
              flexShrink={0}
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <PerpsRecallIllustration />
            </Stack>
            <SizableText {...titleProps} flex={1} minWidth={0}>
              {bannerText}
            </SizableText>
          </XStack>
        )}
        testID="perps-recall-banner"
        onPress={() => {
          void refresh();
          if (platformEnv.isNative || !gtMd) {
            showPerpsActivityCenterDialog({
              initialDetailId: progress.activityId,
            });
          } else {
            showPerpsRecallDialog({
              activityId: progress.activityId,
              instanceId,
            });
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="View comeback reward details"
        bg="$bgSubdued"
        borderRadius="$4"
        borderWidth={0}
        borderColor="$borderSubdued"
        pr="$10"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
      />
      <IconButton
        testID="perps-recall-banner-close"
        accessibilityLabel="Remind me about comeback rewards later"
        position="absolute"
        right="$2"
        top="$2"
        size="small"
        variant="tertiary"
        icon="CrossedSmallOutline"
        onPress={async () => {
          const until =
            await backgroundApiProxy.serviceWalletBanner.snoozeBanner({
              bannerId: dismissKey,
            });
          setLocalSnooze({ key: dismissKey, until });
        }}
      />
    </YStack>
  );
}
