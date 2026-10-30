import {
  Button,
  Dialog,
  NATIVE_HIT_SLOP,
  SizableText,
  Stack,
  useDialogInstance,
} from '@onekeyhq/components';
import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';

import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { openGuideUrl } from './Guide/perpGuideData';
import { PerpsRecallActivityIcon } from './PerpsRecallActivityIcon';
import { PerpsRecallProgressCard } from './PerpsRecallProgressCard';

type IPerpsRecallDialogProps = {
  activityId: string;
  instanceId: string;
};

export function PerpsRecallDialogContent({
  activityId,
  instanceId,
}: IPerpsRecallDialogProps) {
  const recall = usePerpsRecallProgress();
  const { close } = useDialogInstance();
  if (
    recall.instanceId !== instanceId ||
    recall.progress?.activityId !== activityId
  ) {
    return (
      <SizableText color="$textSubdued">
        Activity details are currently unavailable.
      </SizableText>
    );
  }

  const onOpenHelp = async () => {
    await close();
    openGuideUrl(HELP_CENTER_URL);
  };
  return (
    <PerpsRecallProgressCard
      progress={recall.progress}
      hasEnded={recall.hasEnded}
      onOpenHelp={onOpenHelp}
    />
  );
}

export function showPerpsRecallDialog(props: IPerpsRecallDialogProps) {
  return Dialog.show({
    title: 'Comeback rewards',
    showFooter: false,
    renderContent: <PerpsRecallDialogContent {...props} />,
  });
}

export function PerpsRecallAction() {
  const { progress, instanceId, refresh } = usePerpsRecallProgress();
  if (!progress) return null;

  return (
    <Stack w="$5" h="$5" alignItems="center" justifyContent="center">
      <Button
        testID="perp-mobile-activity-center"
        size="small"
        variant="tertiary"
        childrenAsText={false}
        px="$1"
        py="$1"
        mx={-5}
        my={-5}
        hitSlop={NATIVE_HIT_SLOP}
        accessibilityLabel="Comeback rewards"
        onPress={() => {
          void refresh();
          showPerpsRecallDialog({
            activityId: progress.activityId,
            instanceId,
          });
        }}
      >
        <Stack w="$5" h="$5" alignItems="center" justifyContent="center">
          <PerpsRecallActivityIcon />
        </Stack>
      </Button>
    </Stack>
  );
}
