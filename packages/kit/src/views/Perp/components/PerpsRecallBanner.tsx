import {
  Alert,
  Dialog,
  Icon,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { usePerpsRecallBannerVisibility } from '../hooks/usePerpsRecallBannerVisibility';
import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { showPerpsActivityCenterDialog } from './PerpsActivityCenterAction';
import { showPerpsRecallDialog } from './PerpsRecallDialog';
import { PerpsRecallIllustration } from './PerpsRecallIllustration';
import { formatRecallAmount } from './PerpsRecallProgressCard';

function RecallEntryHint({ pairLabel }: { pairLabel: string }) {
  return (
    <YStack gap="$5">
      <XStack
        testID="perps-recall-entry-hint"
        bg="$bgSubdued"
        $theme-dark={{ bg: '$bgStrong' }}
        borderRadius="$4"
        px="$4"
        py="$5"
        minHeight={80}
        gap="$3"
        alignItems="center"
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <XStack flex={1} minWidth={0} gap="$1" alignItems="center">
          <SizableText size="$headingMd" numberOfLines={1} flexShrink={1}>
            {pairLabel}
          </SizableText>
          <Icon
            name="ChevronTriangleDownSmallSolid"
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
        <XStack gap="$3" alignItems="center" flexShrink={0}>
          <Stack
            width="$10"
            height="$10"
            borderRadius="$full"
            bg="$brand3"
            alignItems="center"
            justifyContent="center"
          >
            <Stack width={28} height={24}>
              <PerpsRecallIllustration trimmed />
            </Stack>
          </Stack>
          <Icon
            name="TradingViewCandlesOutline"
            size="$5"
            color="$iconSubdued"
          />
          <Icon name="DotHorOutline" size="$5" color="$iconSubdued" />
        </XStack>
      </XStack>
      <SizableText
        size="$bodyLg"
        accessibilityLabel="View your rewards and trading progress anytime using the rewards icon at the top of the trading screen."
      >
        View your rewards and trading progress here anytime.
      </SizableText>
    </YStack>
  );
}

export function PerpsRecallBanner({ compact = false }: { compact?: boolean }) {
  const { gtMd } = useMedia();
  const { displayName, mode } = useActiveTradeDisplay();
  const { progress, hasEnded, instanceId, refresh } = usePerpsRecallProgress();
  const { isBannerHidden, setBannerHidden } = usePerpsRecallBannerVisibility({
    instanceId,
    activityId: progress?.activityId,
  });
  if (!progress || isBannerHidden) return null;

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
        onPress={() => {
          const showEntryHint = platformEnv.isNative || !gtMd;
          Dialog.show({
            ...(showEntryHint
              ? {
                  showHeader: false,
                  contentContainerProps: { p: '$6' },
                  footerProps: { px: '$6', pb: '$6' },
                  renderContent: (
                    <RecallEntryHint
                      pairLabel={
                        mode === 'spot' ? displayName : `${displayName}USDC`
                      }
                    />
                  ),
                }
              : {
                  description:
                    'You can still view your rewards and trading progress in the Activity Center.',
                }),
            onConfirmText: 'Remind me later',
            showCancelButton: false,
            showExitButton: false,
            onConfirm: () => setBannerHidden(true),
          });
        }}
      />
    </YStack>
  );
}
