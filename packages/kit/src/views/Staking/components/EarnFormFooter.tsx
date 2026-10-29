import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { Page, Stack, YStack } from '@onekeyhq/components';
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

/**
 * An Earn form's button, as Swap's: one large button the form's full width,
 * with the steps above it while they run. On a page (the details page) and
 * in a wide window it ends the form; elsewhere in a modal it is the modal's
 * footer, over the amount stages a phone keyboard shows
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
      <YStack bg="$bgApp" gap="$5">
        {progress}
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
          {progress ? (
            <Stack px="$5" pt="$5">
              {progress}
            </Stack>
          ) : null}
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
