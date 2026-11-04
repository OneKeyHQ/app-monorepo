import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  NATIVE_HIT_SLOP,
  SizableText,
  Stack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

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
  const intl = useIntl();
  const recall = usePerpsRecallProgress();
  const { close } = useDialogInstance();
  if (
    recall.instanceId !== instanceId ||
    recall.progress?.activityId !== activityId
  ) {
    return (
      <SizableText color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.perps_recall_unavailable__msg,
        })}
      </SizableText>
    );
  }

  const { blogUrl } = recall.progress;
  const onOpenHelp = async () => {
    if (!blogUrl) return;
    if (platformEnv.isNative || platformEnv.isDesktop) {
      await close();
    } else {
      // Open the browser tab while the click still has user activation.
      void close();
    }
    if (platformEnv.isNative) {
      openUrlInApp(blogUrl, undefined, { redirectExternalNavigation: true });
    } else {
      openGuideUrl(blogUrl);
    }
  };
  return (
    <PerpsRecallProgressCard
      progress={recall.progress}
      hasEnded={recall.hasEnded}
      onOpenHelp={onOpenHelp}
    />
  );
}

export function showPerpsRecallDialog({
  intl,
  ...props
}: IPerpsRecallDialogProps & { intl: IntlShape }) {
  return Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.perps_recall__title,
    }),
    showFooter: false,
    contentContainerProps: {
      pb: platformEnv.isNative ? '$2' : '$5',
      $md: { pb: '$2' },
    },
    renderContent: <PerpsRecallDialogContent {...props} />,
  });
}

export function PerpsRecallAction() {
  const intl = useIntl();
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
        accessibilityLabel={intl.formatMessage({
          id: ETranslations.perps_recall__title,
        })}
        onPress={() => {
          void refresh();
          showPerpsRecallDialog({
            intl,
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
