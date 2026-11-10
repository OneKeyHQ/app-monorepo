import { Fragment, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  IconButton,
  SizableText,
  Theme,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import {
  EARN_GUIDE_INK,
  GuideStepMark,
  getGuideStepStatus,
} from './EarnDesktopGuideCard';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { EARN_GUIDE_STEPS } from './earnGuide.utils';
import { earnGuideStore, useEarnGuide } from './earnGuideStore';

import type { IEarnGuideStep } from './earnGuide.utils';

/**
 * The guide modal's ink header: its title and close, and the
 * four steps. The card's ghost draws a copy as it grows into the modal
 */
export function EarnGuideHeader({
  shownStep,
  onPickStep,
  onClose,
  isCopy,
}: {
  shownStep: IEarnGuideStep;
  onPickStep?: (step: IEarnGuideStep) => void;
  onClose?: () => void;
  // The ghost's copy: no ink of its own, no title (the card's carries on
  // into its place), nothing to press or find
  isCopy?: boolean;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const { state } = useEarnGuide();
  const tid = (id: string) => (isCopy ? undefined : id);

  // Focus comes into the guide as it opens and as its step changes, to the
  // title: a screen reader starts there and Tab goes on through the guide,
  // not the page under it. A field the step focuses itself keeps it
  const titleRef = useRef<unknown>(null);
  useEffect(() => {
    if (isCopy) {
      return;
    }
    const active = globalThis.document?.activeElement;
    if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) {
      return;
    }
    (
      titleRef.current as {
        focus?: (options?: { preventScroll?: boolean }) => void;
      } | null
    )?.focus?.({ preventScroll: true });
  }, [isCopy, shownStep]);

  return (
    <Theme name="dark">
      <YStack
        testID={tid('earn-guide-header')}
        bg={isCopy ? undefined : EARN_GUIDE_INK}
        px="$5"
        pt="$4"
        pb="$5"
        gap="$4"
        pointerEvents={isCopy ? 'none' : undefined}
        // Where the card's ink ends as it grows into this
        onLayout={
          isCopy
            ? undefined
            : (event) =>
                earnGuideStore.setHeaderHeight(
                  Math.round(event.nativeEvent.layout.height),
                )
        }
      >
        <XStack ai="center" gap="$2">
          {/* Focused by the guide itself, never by Tab, and with no ring: it
              is no control */}
          <YStack
            ref={titleRef as never}
            testID={tid('earn-guide-title')}
            flex={1}
            tabIndex={isCopy ? undefined : -1}
            focusVisibleStyle={{ outlineStyle: 'none' }}
          >
            <SizableText
              size="$headingLg"
              color="$whiteA12"
              opacity={isCopy ? 0 : 1}
            >
              {EARN_DESKTOP_DEMO_COPY.guideTitle}
            </SizableText>
          </YStack>
          <IconButton
            testID={tid('earn-guide-close')}
            variant="tertiary"
            icon="CrossedLargeOutline"
            aria-label={intl.formatMessage({ id: ETranslations.global_close })}
            onPress={onClose}
          />
        </XStack>
        {/* The steps in a line, joined; a joint brightens once the step
            before it is done. Done and current steps open again, the ones
            ahead wait. The ends sit out by their padding, so the marks line
            up with the title */}
        <XStack ai="center" mx="$-2" role="list">
          {EARN_GUIDE_STEPS.map((step, index) => {
            const status = getGuideStepStatus(state, step);
            const canOpen = status !== 'upcoming';
            const isShown = step === shownStep;
            return (
              <Fragment key={step}>
                {index > 0 ? (
                  <YStack
                    flex={1}
                    minWidth="$2"
                    h={1}
                    mx="$1"
                    bg={state.done[index - 1] ? '$whiteA8' : '$whiteA4'}
                  />
                ) : null}
                <XStack
                  testID={tid(`earn-guide-step-${step}`)}
                  role="listitem"
                  aria-current={isShown ? 'step' : undefined}
                  flexShrink={0}
                  ai="center"
                  gap="$2"
                  px="$2"
                  py="$1.5"
                  borderRadius="$2"
                  borderCurve="continuous"
                  bg={isShown ? '$whiteA3' : undefined}
                  // The shown step's light moves over as its body fades in
                  transition={reduceMotion ? undefined : 'quick'}
                  animateOnly={ANIMATE_ONLY_BG_COLOR}
                  cursor={canOpen && !isShown ? 'pointer' : undefined}
                  hoverStyle={
                    canOpen && !isShown ? { bg: '$whiteA2' } : undefined
                  }
                  onPress={canOpen ? () => onPickStep?.(step) : undefined}
                >
                  <GuideStepMark step={step} status={status} />
                  {/* Narrow, only the shown step keeps its name */}
                  <SizableText
                    size={isShown ? '$bodyMdMedium' : '$bodyMd'}
                    color={isShown ? '$whiteA12' : '$whiteA10'}
                    numberOfLines={1}
                    $md={isShown ? undefined : { display: 'none' }}
                  >
                    {EARN_DESKTOP_DEMO_COPY.guideActions[step - 1]}
                  </SizableText>
                </XStack>
              </Fragment>
            );
          })}
        </XStack>
      </YStack>
    </Theme>
  );
}
