import {
  Dialog,
  IconButton,
  SizableText,
  Stack,
  useDialogInstance,
} from '@onekeyhq/components';
import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';

import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { openGuideUrl } from './Guide/perpGuideData';
import { PerpFeatureDot } from './PerpFeatureDot';
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
    <Stack
      position="relative"
      w="$5"
      h="$5"
      alignItems="center"
      justifyContent="center"
    >
      <IconButton
        testID="perp-mobile-activity-center"
        icon="GiftOutline"
        size="small"
        variant="tertiary"
        iconProps={{ color: '$iconSubdued' }}
        title="Comeback rewards"
        onPress={() => {
          void refresh();
          showPerpsRecallDialog({
            activityId: progress.activityId,
            instanceId,
          });
        }}
      />
      <Stack
        position="absolute"
        top={-4}
        right={-4}
        borderRadius="$full"
        borderWidth="$0.5"
        borderColor="$bgApp"
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <PerpFeatureDot testID="perp-mobile-activity-center-dot" />
      </Stack>
    </Stack>
  );
}
