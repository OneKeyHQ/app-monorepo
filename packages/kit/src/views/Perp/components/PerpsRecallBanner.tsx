import {
  Alert,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { showPerpsActivityCenterDialog } from './PerpsActivityCenterAction';
import { showPerpsRecallDialog } from './PerpsRecallDialog';
import { PerpsRecallIllustration } from './PerpsRecallIllustration';
import { formatRecallAmount } from './PerpsRecallProgressCard';

export function PerpsRecallBanner({ compact = false }: { compact?: boolean }) {
  const { gtMd } = useMedia();
  const { progress, hasEnded, instanceId, refresh } = usePerpsRecallProgress();
  if (!progress) return null;

  let bannerText = '';
  if (progress.payoutStatus === 'paid') {
    bannerText =
      progress.paidAmount !== null
        ? `You’ve received ${formatRecallAmount(progress.paidAmount)} USDC in comeback rewards.`
        : 'Your comeback reward has been sent.';
  } else if (progress.payoutStatus === 'skipped') {
    bannerText = 'Comeback reward update · View activity details';
  } else if (progress.status === 'achieved') {
    bannerText = `Target reached! ${formatRecallAmount(progress.earnedReward)} USDC reward awaiting payout.`;
  } else if (hasEnded) {
    bannerText =
      progress.activityStatus === 'ended'
        ? 'Comeback activity ended · View your results'
        : 'Activity ended · Awaiting final results';
  } else if (progress.current) {
    bannerText = `Trade ${formatRecallAmount(progress.current.remaining)} USDC more to earn ${formatRecallAmount(progress.totalReward)} USDC in rewards.`;
  }

  return (
    <YStack
      mx={compact ? '$3' : '$4'}
      mt={compact ? '$4' : undefined}
      mb={compact ? '$0' : '$4'}
    >
      <Alert
        type="default"
        renderTitle={(titleProps) => (
          <XStack alignItems="center" gap={compact ? '$2' : '$3'}>
            <Stack
              width={compact ? 28 : 48}
              height={compact ? 26 : 44}
              flexShrink={0}
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <PerpsRecallIllustration />
            </Stack>
            <SizableText
              {...titleProps}
              size={compact ? '$bodySm' : titleProps.size}
              flex={1}
              minWidth={0}
            >
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
        borderRadius={compact ? '$2' : '$4'}
        borderWidth={0}
        borderColor="$borderSubdued"
        {...(compact ? { px: '$3', py: '$2.5' } : {})}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
      />
    </YStack>
  );
}
