import { useIntl } from 'react-intl';

import {
  Button,
  Progress,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getDustSweepProgress } from '../stateMachine';

import type { IDustSweepSession } from '../stateMachine';

export function DustSweepProgress({
  state,
  onPause,
  onResume,
}: {
  state: IDustSweepSession;
  onPause: () => void;
  onResume: () => void;
}) {
  const intl = useIntl();
  const progress = getDustSweepProgress(state);
  const current = Math.min(progress.completed + 1, progress.total);
  const paused = state.stage === 'paused';
  return (
    <YStack flex={1} gap="$5" py="$5" px="$5">
      <YStack gap="$2">
        <SizableText size="$headingLg">
          {paused
            ? intl.formatMessage(
                { id: ETranslations.sweep_dust_sweep_paused },
                { current, total: progress.total },
              )
            : intl.formatMessage(
                { id: ETranslations.sweep_dust_sweep_conversion_progress },
                { current, total: progress.total },
              )}
        </SizableText>
        <Progress
          animated
          size="medium"
          value={
            progress.total ? (progress.completed / progress.total) * 100 : 0
          }
        />
        {state.failureMessage ? (
          <SizableText color="$red11" size="$bodySm">
            {state.failureMessage}
          </SizableText>
        ) : null}
      </YStack>
      <Stack flex={1} />
      <XStack justifyContent="space-between" alignItems="center">
        <SizableText color="$textSubdued">
          {progress.success} converted · {progress.skipped} skipped
        </SizableText>
        <Button
          testID="dust-sweep-progress-toggle"
          variant="secondary"
          onPress={paused ? onResume : onPause}
          disabled={state.stage === 'completed'}
        >
          {paused ? 'Continue' : 'Stop'}
        </Button>
      </XStack>
    </YStack>
  );
}
