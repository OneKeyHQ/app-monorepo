import { Dialog, SizableText, useDialogInstance } from '@onekeyhq/components';
import { HELP_CENTER_URL } from '@onekeyhq/shared/src/config/appConfig';

import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { openGuideUrl } from './Guide/perpGuideData';
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
