import type { ReactNode } from 'react';
import { createContext, useContext, useRef, useState } from 'react';

import { HeightTransition, Page, Stack, YStack } from '@onekeyhq/components';
import type { IButtonProps, IXStackProps } from '@onekeyhq/components';

import { EarnFooterFade } from './EarnFooterFade';
import { EARN_BUTTON_LOOK_TRANSITION } from './UniversalStake/EarnFormSummary';

/**
 * Where an Earn form's button goes in a modal: the modal's footer, or right
 * under the form, in the form's column, where the window lists its routes
 * beside the form (the wide deposit and Loans windows). Set by those windows
 */
export const EarnFormActionPlacementContext = createContext<
  'footer' | 'inline'
>('footer');

export function useIsEarnActionInline(isInModalContext: boolean) {
  const placement = useContext(EarnFormActionPlacementContext);
  return !isInModalContext || placement === 'inline';
}

// The buttons take the form's full width, as Swap's: one button whole, two
// in equal halves
export const EARN_FULL_WIDTH_BUTTONS: IXStackProps = {
  $gtMd: { ml: '0' },
  w: '100%',
};
export const EARN_HALF_BUTTON: IButtonProps = {
  size: 'large',
  flexGrow: 1,
  flexBasis: 0,
};

// The steps above the button come and go as its words change (an amount
// that needs an approval, a token picked in Pay with), as the form's rows do
const PATH_EASE_MS = 200;
// In the column of the rows' text above it (the summary's inset), close
// over the button it explains
const PATH_INSET = '$3.5';

// The steps above the button, easing in and out: they stay drawn while
// their space closes
function FooterPath({
  progress,
  children,
}: {
  progress?: ReactNode;
  children: (path: ReactNode) => ReactNode;
}) {
  const lastRef = useRef(progress);
  if (progress) {
    lastRef.current = progress;
  }
  const path = progress || lastRef.current;
  // Steps there as the form opens show at once; later ones ease in
  const [isThereAtOpen] = useState(Boolean(progress));
  return (
    <HeightTransition
      hide={!progress}
      duration={PATH_EASE_MS}
      skipInitialAnimation={isThereAtOpen}
    >
      {path ? children(path) : null}
    </HeightTransition>
  );
}

/**
 * An Earn form's button, as Swap's: one large button the form's full width,
 * with the steps it runs above it whenever it names more than one. On a page
 * (the details page) and in a wide window it ends the form; elsewhere in a
 * modal it is the modal's footer, over the amount stages a phone keyboard
 * shows
 */
export function EarnFormFooter({
  isInModalContext,
  progress,
  confirmText,
  confirmButtonProps,
  keyboardStage,
}: {
  isInModalContext: boolean;
  progress?: ReactNode;
  confirmText?: string;
  confirmButtonProps: IButtonProps;
  keyboardStage?: ReactNode;
}) {
  const isInline = useIsEarnActionInline(isInModalContext);
  // Every form's button eases between its looks, the loading form's too:
  // the footer that follows it reuses the same button, which must not take
  // on an animation it didn't start with
  const buttonProps: IButtonProps = {
    ...EARN_BUTTON_LOOK_TRANSITION,
    ...confirmButtonProps,
    w: '100%',
  };
  if (isInline) {
    return (
      <YStack bg="$bgApp">
        <FooterPath progress={progress}>
          {(path) => (
            <Stack px={PATH_INSET} pb="$3">
              {path}
            </Stack>
          )}
        </FooterPath>
        <Page.FooterActions
          p={0}
          onConfirmText={confirmText}
          buttonContainerProps={EARN_FULL_WIDTH_BUTTONS}
          confirmButtonProps={{
            ...buttonProps,
            // The details page keeps its own size
            ...(isInModalContext ? { size: 'large' } : null),
          }}
        />
      </YStack>
    );
  }
  return (
    <Page.Footer>
      <EarnFooterFade>
        <YStack bg="$bgApp">
          <FooterPath progress={progress}>
            {(path) => (
              <Stack px="$5" pt="$5">
                <Stack px={PATH_INSET}>{path}</Stack>
              </Stack>
            )}
          </FooterPath>
          <Page.FooterActions
            onConfirmText={confirmText}
            buttonContainerProps={EARN_FULL_WIDTH_BUTTONS}
            confirmButtonProps={{ ...buttonProps, size: 'large' }}
          />
        </YStack>
        {keyboardStage}
      </EarnFooterFade>
    </Page.Footer>
  );
}
