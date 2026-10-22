import { Fragment } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  SizableText,
  Theme,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  EARN_GUIDE_GREEN,
  GuideStepMark,
  getGuideStepStatus,
} from './EarnDesktopGuideCard';
import { EARN_DESKTOP_DEMO_COPY } from './earnDesktopHomeCopy';
import { EARN_GUIDE_STEPS } from './earnGuide.utils';
import { earnGuideStore, useEarnGuide } from './earnGuideStore';

import type { IEarnGuideStep } from './earnGuide.utils';

/**
 * The guide modal's green header: its title, Hide guide and close, and the
 * four steps. The card's ghost draws a copy as it grows into the modal
 */
export function EarnGuideHeader({
  shownStep,
  onPickStep,
  onHide,
  onClose,
  isCopy,
}: {
  shownStep: IEarnGuideStep;
  onPickStep?: (step: IEarnGuideStep) => void;
  onHide?: () => void;
  onClose?: () => void;
  // The ghost's copy: no green of its own, no title (the card's carries on
  // into its place), nothing to press or find
  isCopy?: boolean;
}) {
  const intl = useIntl();
  const { state } = useEarnGuide();
  const tid = (id: string) => (isCopy ? undefined : id);
  return (
    <Theme name="dark">
      <YStack
        testID={tid('earn-guide-header')}
        bg={isCopy ? undefined : EARN_GUIDE_GREEN}
        px="$5"
        pt="$4"
        pb="$5"
        gap="$4"
        pointerEvents={isCopy ? 'none' : undefined}
        // Where the card's green ends as it grows into this
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
          <SizableText
            testID={tid('earn-guide-title')}
            size="$headingLg"
            color="$whiteA12"
            flex={1}
            opacity={isCopy ? 0 : 1}
          >
            {EARN_DESKTOP_DEMO_COPY.guideTitle}
          </SizableText>
          <Button
            testID={tid('earn-guide-hide')}
            size="small"
            variant="tertiary"
            onPress={onHide}
          >
            {EARN_DESKTOP_DEMO_COPY.guideHide}
          </Button>
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
