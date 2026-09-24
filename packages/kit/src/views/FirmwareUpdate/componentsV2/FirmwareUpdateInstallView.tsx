import { memo, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  Anchor,
  Button,
  HeightTransition,
  Icon,
  IconButton,
  Progress,
  RichSizeableText,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ShimmerTitle } from '@onekeyhq/components/src/composite/DeviceStage/ShimmerTitle';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { useFirmwareVersionValid } from '../hooks/useFirmwareVersionValid';

import { FirmwareUpdateDeviceImage } from './FirmwareUpdateDeviceImage';
import { firmwareUpdateInstallCopy as copy } from './firmwareUpdateInstallCopy';
import {
  formatFirmwareUpdateVersionRange,
  getPrimaryFirmwareUpdateItem,
} from './firmwareUpdateInstallViewModel';

import type {
  IFirmwareUpdateItem,
  IFirmwareUpdateStage,
} from './firmwareUpdateInstallViewModel';
import type { IDeviceType } from '@onekeyfe/hd-core';

export type IFirmwareUpdateInstallViewMode =
  | 'updating'
  | 'error'
  | 'workflowError'
  | 'done';

export type IFirmwareUpdateInstallViewProps = {
  mode: IFirmwareUpdateInstallViewMode;
  deviceType: IDeviceType | undefined;
  items: IFirmwareUpdateItem[];
  stage: IFirmwareUpdateStage;
  progress: number;
  remainingTimeText?: string;
  /** Task-level failure: one sentence under the progress row. */
  errorSentence?: string;
  tutorialUrl?: string;
  /** Workflow-level failure: title + message, no device image. */
  workflowError?: { title: string; message?: string };
  /** WebUSB re-grant instruction shown in the sentence slot. */
  webUsbInstruction?: string;
  doneVersionText?: string;
  doneReleaseUrl?: string;
  /** Primary action of the done state; lives in the content, not the footer. */
  doneAction?: { text: string; onPress: () => void; testID?: string };
  detailsExpanded: boolean;
  onToggleDetails: (expanded: boolean) => void;
  debugInfo?: ReactNode;
};

const CONTENT_MAX_WIDTH = 320;

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
});

/** Lets a one-line text give way inside its row instead of overflowing. */
const SHRINK_TO_FIT = { flexShrink: 1, minWidth: 0 } as const;
const STAGE_ENTER_STYLE = { opacity: 0 } as const;

const DOT_SIZE = 6;
/** One pulse: the ring leaves the dot, spreads and fades. */
const DOT_PULSE_MS = 1800;
const DOT_PULSE_SCALE = 2.5;
const DOT_PULSE_OPACITY = 0.35;

/** The live dot beside the hint: a faint ring keeps spreading out of it. */
function LiveDot() {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 0;
      return undefined;
    }
    pulse.value = withRepeat(
      withTiming(1, {
        duration: DOT_PULSE_MS,
        easing: Easing.out(Easing.ease),
      }),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reducedMotion]);
  const ringStyle = useAnimatedStyle(
    () => ({
      opacity: DOT_PULSE_OPACITY * (1 - pulse.value),
      transform: [{ scale: 1 + (DOT_PULSE_SCALE - 1) * pulse.value }],
    }),
    [pulse],
  );
  return (
    <Stack w={DOT_SIZE} h={DOT_SIZE}>
      {reducedMotion ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
          <Stack w={DOT_SIZE} h={DOT_SIZE} borderRadius="$full" bg="$brand9" />
        </Animated.View>
      )}
      <Stack w={DOT_SIZE} h={DOT_SIZE} borderRadius="$full" bg="$brand9" />
    </Stack>
  );
}

function VersionText({
  item,
  isVersionValid,
  emphasize,
}: {
  item: IFirmwareUpdateItem;
  isVersionValid: (version: string) => boolean;
  emphasize: boolean;
}) {
  const { from, to } = formatFirmwareUpdateVersionRange({
    item,
    isVersionValid,
  });
  // Detail rows reserve the version range's intrinsic width so the flexible
  // label cannot compress short component versions to ellipsis.
  return (
    <XStack
      alignItems="center"
      gap="$2"
      maxWidth="100%"
      flexShrink={emphasize ? 1 : 0}
      minWidth={0}
    >
      {from ? (
        <>
          <SizableText
            size={emphasize ? '$bodyLgMedium' : '$bodyMd'}
            color="$textSubdued"
            numberOfLines={1}
            {...SHRINK_TO_FIT}
          >
            {from}
          </SizableText>
          {emphasize ? (
            <Icon name="ArrowRightOutline" size="$4.5" color="$iconSubdued" />
          ) : (
            <SizableText size="$bodyMd" color="$textSubdued">
              →
            </SizableText>
          )}
        </>
      ) : null}
      <VersionLink
        size={emphasize ? '$bodyLgMedium' : '$bodyMd'}
        color={emphasize ? '$text' : '$textSubdued'}
        releaseUrl={item.releaseUrl}
      >
        {to}
      </VersionLink>
    </XStack>
  );
}

/** Target version; opens the GitHub release page when the server names one. */
function VersionLink({
  releaseUrl,
  size,
  color,
  children,
}: {
  releaseUrl: string | undefined;
  size: '$bodyLg' | '$bodyLgMedium' | '$bodyMd';
  color: '$text' | '$textSubdued';
  children: string;
}) {
  if (!releaseUrl) {
    return (
      <SizableText
        size={size}
        color={color}
        numberOfLines={1}
        {...SHRINK_TO_FIT}
      >
        {children}
      </SizableText>
    );
  }
  return (
    <Anchor
      size={size}
      color="$textSuccess"
      textDecorationLine="underline"
      numberOfLines={1}
      {...SHRINK_TO_FIT}
      href={releaseUrl}
      target="_blank"
      // Inside the pill: follow the link, do not toggle the details card.
      onPress={(e) => {
        e.stopPropagation();
      }}
      testID="firmware-update-release-link"
    >
      {children}
    </Anchor>
  );
}

// Memoized: the install view re-renders on every progress tick while the
// versions never change during an install.
const VersionLine = memo(function VersionLine({
  items,
  detailsExpanded,
  onToggleDetails,
}: {
  items: IFirmwareUpdateItem[];
  detailsExpanded: boolean;
  onToggleDetails: (expanded: boolean) => void;
}) {
  const intl = useIntl();
  const { versionValid } = useFirmwareVersionValid();
  const primary = getPrimaryFirmwareUpdateItem(items);
  if (!primary) {
    return null;
  }
  if (items.length <= 1) {
    return (
      <VersionText item={primary} isVersionValid={versionValid} emphasize />
    );
  }
  if (!detailsExpanded) {
    return (
      <XStack
        alignItems="center"
        maxWidth="100%"
        borderRadius="$full"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        bg="$bg"
        px="$3"
        py="$0.5"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={() => onToggleDetails(true)}
        userSelect="none"
        testID="firmware-update-details-pill"
      >
        <VersionText item={primary} isVersionValid={versionValid} emphasize />
      </XStack>
    );
  }
  return (
    <YStack
      w="100%"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      bg="$bg"
      borderRadius="$3"
      px="$3"
      py="$0.5"
      testID="firmware-update-details-card"
    >
      <XStack alignItems="center" justifyContent="space-between" py="$1.5">
        <SizableText
          size="$headingXs"
          color="$textDisabled"
          textTransform="uppercase"
        >
          {intl.formatMessage({ id: ETranslations.global_details })}
        </SizableText>
        <IconButton
          icon="CrossedSmallOutline"
          size="small"
          variant="tertiary"
          onPress={() => onToggleDetails(false)}
          testID="firmware-update-details-close"
        />
      </XStack>
      {items.map((item) => (
        <XStack
          key={item.key}
          alignItems="center"
          justifyContent="space-between"
          gap="$2"
          py="$1.5"
        >
          <SizableText size="$bodyMd" flex={1}>
            {item.name}
          </SizableText>
          {item.noVersion ? null : (
            <VersionText
              item={item}
              isVersionValid={versionValid}
              emphasize={false}
            />
          )}
        </XStack>
      ))}
    </YStack>
  );
});

export function FirmwareUpdateInstallView({
  mode,
  deviceType,
  items,
  stage,
  progress,
  remainingTimeText,
  errorSentence,
  tutorialUrl,
  workflowError,
  webUsbInstruction,
  doneVersionText,
  doneReleaseUrl,
  doneAction,
  detailsExpanded,
  onToggleDetails,
  debugInfo,
}: IFirmwareUpdateInstallViewProps) {
  const intl = useIntl();
  const isDone = mode === 'done';
  // Model name only ("OneKey Pro"); the Bluetooth name stays in the header.
  const deviceName = deviceType
    ? deviceUtils.getDeviceModelNameByType(deviceType)
    : '';
  // The success badge pops only after the progress block has collapsed;
  // a page that mounts already done shows it at once.
  const [revealDoneBadge, setRevealDoneBadge] = useState(isDone);
  useEffect(() => {
    if (!isDone) {
      setRevealDoneBadge(false);
    }
  }, [isDone]);
  // HeightTransition re-captures this callback whenever `hide` flips, which
  // is exactly the `isDone` transition.
  const handleProgressCollapsed = useCallback(() => {
    setRevealDoneBadge(isDone);
  }, [isDone]);

  if (mode === 'workflowError' && workflowError) {
    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$2"
        py="$10"
        testID="firmware-update-workflow-error"
      >
        <SizableText size="$headingXl" textAlign="center">
          {workflowError.title}
        </SizableText>
        {workflowError.message ? (
          <SizableText
            size="$bodyLg"
            color="$textSubdued"
            textAlign="center"
            maxWidth={CONTENT_MAX_WIDTH}
          >
            {workflowError.message}
          </SizableText>
        ) : null}
      </YStack>
    );
  }

  return (
    <YStack flex={1} alignItems="center" py="$5">
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        w="100%"
        maxWidth={CONTENT_MAX_WIDTH}
      >
        <FirmwareUpdateDeviceImage
          deviceType={deviceType}
          done={isDone && revealDoneBadge}
        />
        <YStack alignItems="center" gap="$1.5" w="100%" pt="$6">
          <SizableText size="$heading2xl" textAlign="center">
            {isDone
              ? intl.formatMessage({
                  id: ETranslations.firmware_update_done__title,
                })
              : copy.updatingDevice(intl, deviceName)}
          </SizableText>
          {isDone && doneVersionText ? (
            <VersionLink
              size="$bodyLg"
              color="$textSubdued"
              releaseUrl={doneReleaseUrl}
            >
              {doneVersionText}
            </VersionLink>
          ) : null}
          {isDone ? null : (
            <VersionLine
              items={items}
              detailsExpanded={detailsExpanded}
              onToggleDetails={onToggleDetails}
            />
          )}
        </YStack>
        {/* Collapses on completion so the block above re-centres
            smoothly instead of jumping. */}
        <HeightTransition
          hide={isDone}
          style={styles.fullWidth}
          onHeightDidAnimate={handleProgressCollapsed}
        >
          <YStack w="100%" gap="$3" pt="$8">
            <Progress size="medium" value={progress} indicatorColor="$brand9" />
            <XStack alignItems="center" justifyContent="space-between" gap="$2">
              {/* Enter only: the new word fades in where the old one was,
                  with no exit. A sequenced exit + enter ran twice per
                  swap, and on native the `quick` spring takes ~0.9s to
                  settle opacity, so back-to-back SDK stages kept the word
                  translucent for seconds (OK-63510). 150ms timing on both
                  platforms. */}
              <Stack
                key={stage}
                transition="popoverQuick"
                animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                enterStyle={STAGE_ENTER_STYLE}
              >
                <ShimmerTitle
                  size="$headingSm"
                  band="text"
                  paused={mode !== 'updating'}
                >
                  {copy.stage(intl, stage)}
                </ShimmerTitle>
              </Stack>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                flexShrink={0}
                testID="firmware-update-progress-meta"
              >
                {copy.progressMeta(progress, remainingTimeText)}
              </SizableText>
            </XStack>
          </YStack>
        </HeightTransition>
        {/* Grows in as the progress block collapses; the two are nearly the
            same height, so the centred block barely moves and no footer
            has to appear. */}
        <HeightTransition hide={!isDone} style={styles.fullWidth}>
          {doneAction ? (
            <YStack alignItems="center" pt="$8">
              <Button
                variant="primary"
                size="medium"
                minWidth={144}
                onPress={doneAction.onPress}
                testID={doneAction.testID}
              >
                {doneAction.text}
              </Button>
            </YStack>
          ) : null}
        </HeightTransition>
        {debugInfo ? <Stack pt="$6">{debugInfo}</Stack> : null}
      </YStack>
      <HeightTransition hide={isDone} style={styles.fullWidth}>
        <MessageSlot
          mode={mode}
          errorSentence={errorSentence}
          tutorialUrl={tutorialUrl}
          webUsbInstruction={webUsbInstruction}
        />
      </HeightTransition>
    </YStack>
  );
}

/**
 * One slot above the footer for whatever the page has to say right now:
 * the keep-connected hint, the WebUSB re-grant instruction, or the failure
 * sentence. Sharing the slot keeps the layout still when the state flips
 * and keeps the failure next to Retry / Get help.
 */
function MessageSlot({
  mode,
  errorSentence,
  tutorialUrl,
  webUsbInstruction,
}: Pick<
  IFirmwareUpdateInstallViewProps,
  'mode' | 'errorSentence' | 'tutorialUrl' | 'webUsbInstruction'
>) {
  const intl = useIntl();
  if (mode === 'error' && errorSentence) {
    return (
      <YStack alignItems="center" gap="$2" w="100%" pt="$8">
        <SizableText
          size="$bodyMd"
          color="$textCritical"
          textAlign="center"
          testID="firmware-update-error-sentence"
        >
          {errorSentence}
        </SizableText>
        {tutorialUrl ? (
          <RichSizeableText
            size="$bodyMd"
            color="$textSubdued"
            textAlign="center"
            linkList={{ url: { url: tutorialUrl } }}
          >
            {ETranslations.update_follow_online_tutorial_to_proceed_manually}
          </RichSizeableText>
        ) : null}
      </YStack>
    );
  }
  if (mode !== 'updating') {
    return null;
  }
  if (webUsbInstruction) {
    return (
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        textAlign="center"
        pt="$8"
      >
        {webUsbInstruction}
      </SizableText>
    );
  }
  return (
    <XStack alignItems="center" justifyContent="center" gap="$2" pt="$8">
      <LiveDot />
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.firmware_update_keep_device_connected__msg,
        })}
      </SizableText>
    </XStack>
  );
}
