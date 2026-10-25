import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import { Icon, SizableText, Theme, XStack, YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import { EARN_GUIDE_STEPS } from './earnGuide.utils';
import { earnGuideStore, useEarnGuide } from './earnGuideStore';

import type { IEarnGuideState, IEarnGuideStep } from './earnGuide.utils';
import type { IEarnGuideCardPlace } from './earnGuideStore';

// OneKey green a few steps darker (the dark palette's brand7, opaque: the
// theme's own brand7 is translucent and would turn pale on the light page).
// White type reads on it, and it sits quietly beside the banner's artwork
export const EARN_GUIDE_GREEN = '#2B6A25';
export const EARN_GUIDE_GREEN_HOVER = '#2F7329';
// The banner's Join pill beside the card: pure white, 30 tall
const EARN_GUIDE_PILL_BG = '#FFFFFF';
const EARN_GUIDE_PILL_HEIGHT = 30;

export type IEarnGuideStepStatus = 'done' | 'current' | 'upcoming';

export const getGuideStepStatus = (
  state: IEarnGuideState,
  step: IEarnGuideStep,
): IEarnGuideStepStatus => {
  if (step === state.current && !state.done[step - 1]) {
    return 'current';
  }
  return state.done[step - 1] ? 'done' : 'upcoming';
};

/** A step's number in a circle; a done step's check takes its place */
export function GuideStepMark({
  step,
  status,
}: {
  step: IEarnGuideStep;
  status: IEarnGuideStepStatus;
}) {
  if (status === 'done') {
    return (
      <YStack
        w="$5"
        h="$5"
        borderRadius="$full"
        bg="$whiteA4"
        ai="center"
        jc="center"
      >
        <Icon name="CheckLargeOutline" size="$3.5" color="$whiteA12" />
      </YStack>
    );
  }
  const isCurrent = status === 'current';
  return (
    <YStack
      w="$5"
      h="$5"
      borderRadius="$full"
      bg={isCurrent ? '$whiteA12' : undefined}
      borderWidth={isCurrent ? 0 : 1.5}
      borderColor="$whiteA6"
      ai="center"
      jc="center"
    >
      <SizableText
        size="$bodySmMedium"
        color={isCurrent ? EARN_GUIDE_GREEN : '$whiteA10'}
      >
        {step}
      </SizableText>
    </YStack>
  );
}

export const EARN_GUIDE_CARD_RADIUS = 12;
// The banner beside centres its 30 tall Join pill in a 60 tall bar, 15 from
// its bottom; the card's pill sits on the same line
export const EARN_GUIDE_CARD_PB = 15;

/** The card's title, which the modal's header carries on */
export function GuideCardTitle() {
  return (
    <SizableText size="$headingLg" color="$whiteA12" numberOfLines={1}>
      {EARN_DESKTOP_DEMO_COPY.guideTitle}
    </SizableText>
  );
}

/** The four steps and the current one's action, under the title */
export function GuideCardSteps({ state }: { state: IEarnGuideState }) {
  const intl = useIntl();
  const { live, isPreview } = useEarnGuide();
  // Without a wallet the first thing to do is connect one, as the guide's
  // first step then asks; the preview shows the steps as with a wallet
  const action =
    !isPreview && live && !live.hasWallet && state.current === 1
      ? intl.formatMessage({ id: ETranslations.global_connect_wallet })
      : EARN_DESKTOP_DEMO_COPY.guideActions[state.current - 1];
  return (
    // Narrow, the action goes under the steps at the card's width, so the
    // steps keep theirs
    <XStack
      ai="flex-end"
      jc="space-between"
      gap="$4"
      $md={{ flexDirection: 'column', alignItems: 'stretch' }}
    >
      <YStack gap="$2.5" flexShrink={1} minWidth={0}>
        {EARN_GUIDE_STEPS.map((step) => {
          const status = getGuideStepStatus(state, step);
          return (
            <XStack
              key={step}
              testID={`earn-desktop-guide-row-${step}`}
              aria-current={status === 'current' ? 'step' : undefined}
              ai="center"
              gap="$2.5"
            >
              <GuideStepMark step={step} status={status} />
              {/* 0.8 white is the faintest that still reads at 4.5:1 on
                  the green; the mark and the weight carry the rest */}
              <SizableText
                size={status === 'current' ? '$bodyLgMedium' : '$bodyLg'}
                color={status === 'current' ? '$whiteA12' : '$whiteA10'}
                numberOfLines={1}
              >
                {EARN_DESKTOP_DEMO_COPY.guideSteps[step - 1]}
              </SizableText>
            </XStack>
          );
        })}
      </YStack>
      {/* The card's own action, not a second button: pressing anywhere on
          the card does the same */}
      <XStack
        testID="earn-desktop-guide-action"
        flexShrink={0}
        h={EARN_GUIDE_PILL_HEIGHT}
        px="$4"
        ai="center"
        jc="center"
        borderRadius="$full"
        borderCurve="continuous"
        bg={EARN_GUIDE_PILL_BG}
        $md={{ h: '$10' }}
        aria-hidden
      >
        <SizableText
          size="$bodyMdMedium"
          color="$textInverse"
          numberOfLines={1}
        >
          {action}
        </SizableText>
      </XStack>
    </XStack>
  );
}

/**
 * Stands in the hero for a wallet without positions: the four steps from
 * adding ETH on Base to the first position, the current one stressed, and its
 * action at the bottom right. The whole card opens the guide
 */
export function EarnDesktopGuideCard({
  state,
  minHeight,
  onOpen,
  onHeightChange,
}: {
  state: IEarnGuideState;
  /** The banner card's shortest height, when the banner sits beside */
  minHeight?: number;
  onOpen: (from: IEarnGuideCardPlace | undefined) => void;
  onHeightChange?: (height: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  const cardRef = useRef<unknown>(null);
  // This layout renders on web and desktop only, where the card is a DOM
  // element: the guide grows out of where it sits and goes back there. The
  // card stays in its place under the guide all the while
  const measure = useCallback((): IEarnGuideCardPlace | undefined => {
    const element = cardRef.current as HTMLElement | null;
    const rect = element?.getBoundingClientRect?.();
    return rect && rect.width > 0
      ? {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          isHovered: Boolean(element?.matches?.(':hover')),
        }
      : undefined;
  }, []);
  useEffect(() => {
    earnGuideStore.setCardMeasurer(measure);
    return () => earnGuideStore.setCardMeasurer(undefined);
  }, [measure]);
  const handleOpen = useCallback(() => onOpen(measure()), [measure, onOpen]);

  return (
    <Theme name="dark">
      <YStack
        ref={cardRef as never}
        testID="earn-desktop-guide-card"
        role="button"
        aria-label={EARN_DESKTOP_DEMO_COPY.guideTitle}
        flex={1}
        minWidth={0}
        minHeight={minHeight}
        p="$5"
        pb={EARN_GUIDE_CARD_PB}
        // Narrow, the action spans the card under the steps: even padding
        $md={{ pb: '$5' }}
        gap="$4"
        jc="space-between"
        bg={EARN_GUIDE_GREEN}
        hoverStyle={{ bg: EARN_GUIDE_GREEN_HOVER }}
        borderRadius={EARN_GUIDE_CARD_RADIUS}
        borderCurve="continuous"
        cursor="pointer"
        userSelect="none"
        pressStyle={{ scale: 0.98 }}
        transition={reducedMotion ? undefined : 'fast'}
        animateOnly={ANIMATE_ONLY_TRANSFORM}
        onPress={handleOpen}
        onLayout={(event) =>
          onHeightChange?.(Math.round(event.nativeEvent.layout.height))
        }
        {...buildKeyboardPressProps(handleOpen, 2)}
      >
        <GuideCardTitle />
        <GuideCardSteps state={state} />
      </YStack>
    </Theme>
  );
}
