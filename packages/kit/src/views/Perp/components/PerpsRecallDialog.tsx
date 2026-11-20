import { useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  NATIVE_HIT_SLOP,
  SizableText,
  Stack,
  useDialogInstance,
  useMedia,
} from '@onekeyhq/components';
import { useVisibleImpression } from '@onekeyhq/kit/src/hooks/useVisibleImpression';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  type IPerpRecallEntrySource,
  getPerpRecallEventParams,
} from '@onekeyhq/shared/src/logger/scopes/perp/scenes/recall';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePerpsRecallEntry } from '../hooks/usePerpsRecallEntry';
import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { openGuideUrl } from './Guide/perpGuideData';
import { PerpsRecallActivityIcon } from './PerpsRecallActivityIcon';
import { PerpsRecallProgressCard } from './PerpsRecallProgressCard';

type IPerpsRecallDialogProps = {
  entrySource: IPerpRecallEntrySource;
  activityId: string;
  instanceId: string;
};

export function PerpsRecallDialogContent({
  entrySource,
  activityId,
  instanceId,
}: IPerpsRecallDialogProps) {
  const intl = useIntl();
  const recall = usePerpsRecallProgress();
  const { close } = useDialogInstance();
  const { gtMd } = useMedia();
  const progress =
    recall.instanceId === instanceId &&
    recall.progress?.activityId === activityId
      ? recall.progress
      : null;
  const params =
    progress &&
    getPerpRecallEventParams(
      progress,
      entrySource,
      gtMd && !platformEnv.isNative ? 'wide' : 'compact',
    );
  const seen = useRef(new Set<string>()).current;
  const impressionRef = useVisibleImpression({
    impressionKey: params?.activityId,
    seen,
    onShown: () => {
      if (params) defaultLogger.perp.recall.perpRecallDetailShown(params);
    },
  });
  if (!progress || !params) {
    return (
      <SizableText color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.perps_recall_unavailable__msg,
        })}
      </SizableText>
    );
  }

  const { blogUrl } = progress;
  const onOpenHelp = async () => {
    if (!blogUrl) return;
    defaultLogger.perp.recall.perpRecallHelpClicked(params);
    if (platformEnv.isNative || platformEnv.isDesktop) {
      await close();
    } else {
      // Open the browser tab while the click still has user activation.
      void close();
    }
    openGuideUrl(blogUrl);
  };
  return (
    <PerpsRecallProgressCard
      impressionRef={impressionRef}
      progress={progress}
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
  const isFocused = useIsFocused();
  const tracking = usePerpsRecallEntry({
    progress,
    instanceId,
    entrySource: 'headerIcon',
    enabled: isFocused,
  });
  if (!progress) return null;

  return (
    <Stack
      ref={tracking.impressionRef}
      collapsable={false}
      w="$5"
      h="$5"
      alignItems="center"
      justifyContent="center"
    >
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
          tracking.trackClick();
          void refresh();
          showPerpsRecallDialog({
            intl,
            activityId: progress.activityId,
            entrySource: 'headerIcon',
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
