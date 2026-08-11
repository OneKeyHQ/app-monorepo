import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, Badge, Icon, Stack } from '@onekeyhq/components';
import type { ICustomInjectedProtocol } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

import {
  CustomInjectedToolbarIconButton,
  CustomInjectedToolbarIconGroup,
} from './CustomInjectedToolbarIconGroup';

export type ICustomInjectedReviewState =
  ICustomInjectedProtocol['manualReview']['state'];
export type ICustomInjectedManualReviewState = Exclude<
  ICustomInjectedReviewState,
  'processed'
>;

export const CUSTOM_INJECTED_REVIEW_STATE_ORDER: ICustomInjectedReviewState[] =
  ['pending', 'processed', 'unsupported'];

export const CUSTOM_INJECTED_REVIEW_STATE_CONFIG = {
  pending: {
    backgroundColor: '$bgCaution',
    badgeType: 'warning',
    description: 'Needs review',
    icon: 'ClockTimeHistoryOutline',
    iconColor: '$iconCaution',
    label: 'Pending',
    textColor: '$textCaution',
  },
  processed: {
    backgroundColor: '$bgSuccess',
    badgeType: 'success',
    description: 'Set by OneKey marker detection',
    icon: 'CheckRadioSolid',
    iconColor: '$iconSuccess',
    label: 'Processed',
    textColor: '$textSuccess',
  },
  unsupported: {
    backgroundColor: '$bgCritical',
    badgeType: 'critical',
    description: 'No usable DApp',
    icon: 'XCircleSolid',
    iconColor: '$iconCritical',
    label: 'Unsupported',
    textColor: '$textCritical',
  },
} as const;

export function CustomInjectedReviewStatusBadge({
  badgeSize = 'sm',
  onPress,
  state,
  testID,
}: {
  badgeSize?: 'lg' | 'sm';
  onPress?: () => void;
  state: ICustomInjectedReviewState;
  testID?: string;
}) {
  const config = CUSTOM_INJECTED_REVIEW_STATE_CONFIG[state];
  return (
    <Badge
      badgeSize={badgeSize}
      badgeType={config.badgeType}
      borderRadius="$2"
      gap="$1.5"
      testID={testID}
      onPress={onPress}
      {...(onPress
        ? {
            hoverStyle: { opacity: 0.85 },
            pressStyle: { opacity: 0.7 },
          }
        : undefined)}
    >
      <Icon color={config.iconColor} name={config.icon} size="$3.5" />
      <Badge.Text>{config.label}</Badge.Text>
    </Badge>
  );
}

export function CustomInjectedReviewStatusIcons({
  disabled,
  onChange,
  state,
  updatingState,
}: {
  disabled?: boolean;
  onChange: (state: ICustomInjectedManualReviewState) => void;
  state: ICustomInjectedReviewState;
  updatingState?: ICustomInjectedReviewState;
}) {
  const previousStateRef = useRef(state);
  const [processedAnimationPhase, setProcessedAnimationPhase] = useState<
    0 | 1 | 2 | 3
  >(0);

  useEffect(() => {
    const becameProcessed =
      previousStateRef.current !== 'processed' && state === 'processed';
    previousStateRef.current = state;
    if (!becameProcessed) {
      setProcessedAnimationPhase(0);
      return undefined;
    }
    setProcessedAnimationPhase(1);
    const recoilTimer = setTimeout(() => {
      setProcessedAnimationPhase(2);
    }, 170);
    const reboundTimer = setTimeout(() => {
      setProcessedAnimationPhase(3);
    }, 340);
    const finishTimer = setTimeout(() => {
      setProcessedAnimationPhase(0);
    }, 700);
    return () => {
      clearTimeout(recoilTimer);
      clearTimeout(reboundTimer);
      clearTimeout(finishTimer);
    };
  }, [state]);

  let processedCellScale = 1;
  if (processedAnimationPhase === 1) {
    processedCellScale = 1.35;
  } else if (processedAnimationPhase === 2) {
    processedCellScale = 0.9;
  } else if (processedAnimationPhase === 3) {
    processedCellScale = 1.18;
  }

  return (
    <CustomInjectedToolbarIconGroup testID="custom-injected-review-state">
      {CUSTOM_INJECTED_REVIEW_STATE_ORDER.map((reviewState) => {
        const config = CUSTOM_INJECTED_REVIEW_STATE_CONFIG[reviewState];
        const selected = state === reviewState;
        const manuallySelectable = reviewState !== 'processed';
        const optionDisabled = disabled || !manuallySelectable;
        return (
          <CustomInjectedToolbarIconButton
            key={reviewState}
            accessibilityLabel={
              manuallySelectable
                ? `Set status to ${config.label}`
                : 'Processed status, set automatically by OneKey icon or wallet ID detection'
            }
            accessibilityState={{ disabled: optionDisabled, selected }}
            bg={selected ? config.backgroundColor : '$transparent'}
            cellScale={reviewState === 'processed' ? processedCellScale : 1}
            disabled={optionDisabled}
            icon={config.icon}
            iconProps={{
              color: selected ? config.iconColor : '$iconSubdued',
            }}
            loading={updatingState === reviewState}
            opacity={selected ? 1 : 0.5}
            overlay={
              <>
                <AnimatePresence>
                  {reviewState === 'processed' &&
                  processedAnimationPhase > 0 ? (
                    <Stack
                      animation="medium"
                      bg="$bgSuccess"
                      borderRadius="$full"
                      enterStyle={{ opacity: 0, scale: 0.45 }}
                      exitStyle={{ opacity: 0, scale: 2.25 }}
                      h="$10"
                      opacity={0.5}
                      pointerEvents="none"
                      position="absolute"
                      scale={1.28}
                      testID="custom-injected-review-state-processed-pulse"
                      w="$10"
                    />
                  ) : null}
                </AnimatePresence>
                <AnimatePresence>
                  {reviewState === 'processed' &&
                  processedAnimationPhase > 0 ? (
                    <Stack
                      animation="slow"
                      borderColor="$borderSuccess"
                      borderRadius="$full"
                      borderWidth={2}
                      enterStyle={{ opacity: 0, scale: 0.55 }}
                      exitStyle={{ opacity: 0, scale: 2.7 }}
                      h="$10"
                      opacity={0.9}
                      pointerEvents="none"
                      position="absolute"
                      scale={1.12}
                      testID="custom-injected-review-state-processed-ring"
                      w="$10"
                    />
                  ) : null}
                </AnimatePresence>
              </>
            }
            testID={`custom-injected-review-state-${reviewState}`}
            title={`${config.label} · ${config.description}`}
            onPress={
              manuallySelectable ? () => onChange(reviewState) : undefined
            }
          />
        );
      })}
    </CustomInjectedToolbarIconGroup>
  );
}
