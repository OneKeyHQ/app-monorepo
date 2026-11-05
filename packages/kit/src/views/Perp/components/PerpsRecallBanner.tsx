import type { RefObject } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

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
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { usePerpsRecallBannerVisibility } from '../hooks/usePerpsRecallBannerVisibility';
import { usePerpsRecallEntry } from '../hooks/usePerpsRecallEntry';
import { usePerpsRecallProgress } from '../hooks/usePerpsRecallProgress';

import { PerpsRecallDesktopHint } from './PerpsRecallDesktopHint';
import { showPerpsRecallDialog } from './PerpsRecallDialog';
import { PerpsRecallIllustration } from './PerpsRecallIllustration';

import type { ViewInstance } from 'react-native';

function RecallEntryHint({
  pairLabel,
  desktop = false,
}: {
  pairLabel: string;
  desktop?: boolean;
}) {
  const intl = useIntl();
  const isDarkTheme = useThemeVariant() === 'dark';
  return (
    <YStack gap="$5">
      <XStack
        testID="perps-recall-entry-hint"
        bg={isDarkTheme ? '$bgStrong' : '$bgSubdued'}
        {...(desktop && { bg: isDarkTheme ? '$bgApp' : '$bgSubdued' })}
        borderRadius="$4"
        px={desktop ? '$0' : '$4'}
        py={desktop ? '$0' : '$5'}
        minHeight={80}
        gap="$3"
        alignItems="center"
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        {desktop ? (
          <PerpsRecallDesktopHint webDapp={platformEnv.isWebDappMode} />
        ) : (
          <>
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
          </>
        )}
      </XStack>
      <SizableText
        size="$bodyLg"
        accessibilityLabel={
          desktop
            ? undefined
            : intl.formatMessage({
                id: ETranslations.perps_recall_entry_accessibility__desc,
              })
        }
      >
        {desktop
          ? intl.formatMessage({ id: ETranslations.perps_recall_hidden__desc })
          : intl.formatMessage({
              id: ETranslations.perps_recall_entry_hint__desc,
            })}
      </SizableText>
    </YStack>
  );
}

export function PerpsRecallBanner({
  compact = false,
  viewportRef,
}: {
  compact?: boolean;
  viewportRef?: RefObject<Pick<ViewInstance, 'measureInWindow'> | null>;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { displayName, mode } = useActiveTradeDisplay();
  const { progress, instanceId, refresh } = usePerpsRecallProgress();
  const { isBannerHidden, setBannerHidden } = usePerpsRecallBannerVisibility({
    instanceId,
    progress,
  });
  const isFocused = useIsFocused();
  const tracking = usePerpsRecallEntry({
    progress,
    instanceId,
    entrySource: 'banner',
    enabled: isFocused && !isBannerHidden && Boolean(progress?.title?.trim()),
    viewportRef,
  });
  if (!progress?.title?.trim() || isBannerHidden) return null;
  const title = progress.title.replace(/\bUSDT\b/g, 'USDC');

  return (
    <YStack
      ref={tracking.impressionRef}
      collapsable={false}
      mx={compact ? '$3' : '$4'}
      mt={compact ? '$4' : undefined}
      mb={compact ? '$0' : '$4'}
    >
      <Alert
        type="default"
        titleNumberOfLines={2}
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
              {title}
            </SizableText>
          </XStack>
        )}
        testID="perps-recall-banner"
        onPress={() => {
          tracking.trackClick();
          void refresh();
          showPerpsRecallDialog({
            intl,
            activityId: progress.activityId,
            entrySource: 'banner',
            instanceId,
          });
        }}
        accessibilityRole="button"
        accessibilityLabel={intl.formatMessage({
          id: ETranslations.perps_recall__title,
        })}
        bg="$bgSubdued"
        borderRadius={compact ? '$3' : '$4'}
        borderWidth={0}
        borderColor="$borderSubdued"
        {...(compact ? { px: '$3', py: '$2.5' } : {})}
        pr={progress.closable ? '$10' : undefined}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
      />
      {progress.closable ? (
        <IconButton
          testID="perps-recall-banner-close"
          accessibilityLabel={intl.formatMessage({
            id: ETranslations.perps_recall_remind_later__action,
          })}
          position="absolute"
          right="$2"
          top="$2"
          size="small"
          variant="tertiary"
          icon="CrossedSmallOutline"
          onPress={() => {
            Dialog.show({
              showHeader: false,
              contentContainerProps: { p: '$6' },
              footerProps: { px: '$6', pb: '$6' },
              renderContent: (
                <RecallEntryHint
                  desktop={!platformEnv.isNative && gtMd}
                  pairLabel={
                    mode === 'spot' ? displayName : `${displayName}USDC`
                  }
                />
              ),
              onConfirmText: intl.formatMessage({
                id: ETranslations.perps_recall_remind_later__action,
              }),
              showCancelButton: false,
              showExitButton: false,
              onConfirm: () => {
                setBannerHidden(true);
                tracking.trackDismiss();
              },
            });
          }}
        />
      ) : null}
    </YStack>
  );
}
