import { useState } from 'react';

import { type IntlShape, useIntl } from 'react-intl';

import {
  Badge,
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

type IMode = 'split' | 'single';

function ModeCard({
  mode,
  active,
  onPress,
}: {
  mode: IMode;
  active: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  // LayoutColumnOutline draws two columns split by a vertical divider;
  // StopOutline is an empty rounded rectangle of the same outer shape with
  // no divider — the visual diff isolates exactly what the choice means.
  const icon: IKeyOfIcons =
    mode === 'split' ? 'LayoutColumnOutline' : 'StopOutline';
  const title =
    mode === 'split'
      ? ETranslations.split_view_option_split
      : ETranslations.split_view_option_single;
  const desc =
    mode === 'split'
      ? ETranslations.split_view_option_split_desc
      : ETranslations.split_view_option_single_desc;

  return (
    <Stack
      flex={1}
      p="$4"
      gap="$3"
      borderRadius="$3"
      borderWidth={2}
      borderColor={active ? '$borderActive' : '$borderSubdued'}
      backgroundColor={active ? '$bgActive' : '$bgSubdued'}
      hoverStyle={{ borderColor: '$borderActive' }}
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
      cursor="pointer"
    >
      <Icon name={icon} size="$10" color="$iconActive" />
      <YStack gap="$1">
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <SizableText size="$bodyLgMedium">
            {intl.formatMessage({ id: title })}
          </SizableText>
          {mode === 'split' ? (
            <Badge badgeType="info" badgeSize="sm">
              {intl.formatMessage({ id: ETranslations.global_recommend })}
            </Badge>
          ) : null}
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: desc })}
        </SizableText>
      </YStack>
    </Stack>
  );
}

function PromptContent({
  initialMode,
  onPick,
}: {
  initialMode: IMode;
  onPick: (m: IMode) => void;
}) {
  const intl = useIntl();
  const [picked, setPicked] = useState<IMode>(initialMode);

  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.split_view_prompt_body })}
      </SizableText>
      <XStack gap="$3" $md={{ flexDirection: 'column' }}>
        {(['split', 'single'] as const).map((mode) => (
          <ModeCard
            key={mode}
            mode={mode}
            active={picked === mode}
            onPress={() => {
              setPicked(mode);
              onPick(mode);
            }}
          />
        ))}
      </XStack>
    </YStack>
  );
}

export function showSplitViewPromptDialog({
  currentEnabled,
  intl,
}: {
  currentEnabled: boolean;
  intl: IntlShape;
}) {
  let picked: IMode = currentEnabled ? 'split' : 'single';

  Dialog.show({
    icon: 'LayoutColumnOutline',
    title: intl.formatMessage({
      id: ETranslations.split_view_prompt_title,
    }),
    dismissOnOverlayPress: false,
    showCancelButton: false,
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_continue,
    }),
    renderContent: (
      <PromptContent
        initialMode={picked}
        onPick={(m) => {
          picked = m;
        }}
      />
    ),
    onConfirm: async ({ close }) => {
      await backgroundApiProxy.serviceSpotlight.firstVisitTour(
        ESpotlightTour.splitViewFirstPrompt,
      );
      const targetEnabled = picked === 'split';
      if (targetEnabled === currentEnabled) {
        await close();
        return;
      }
      await backgroundApiProxy.serviceSetting.setEnableSplitView(targetEnabled);
      await close();
      setTimeout(() => {
        void backgroundApiProxy.serviceApp.restartApp();
      }, 300);
    },
  });
}
