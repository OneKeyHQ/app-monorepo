import type { IYStackProps } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';

// A row of a list unfolding in place (Pay with's tokens, the protocol list,
// a token's offers on the Earn home) comes in faded and 4 px up, each a
// moment after the one above
export const LIST_ROW_STAGGER_MS = 20;
export const LIST_ROW_ENTER_STYLE = { opacity: 0, y: -4 } as const;
// The lists open over 250 ms and fold over 200 ms on the app's smooth curve
export const LIST_FOLD_MS = 200;
// A pick is applied once the fold is done and a moment has passed, so the
// modal tells the new form from the fold and eases to its height
export const LIST_PICK_APPLY_MS = LIST_FOLD_MS + 40;
// The list fading out as it folds
export const LIST_HIDDEN_STYLE = { opacity: 0 } as const;
// Reduced motion: the list opens and folds at once, its rows show as it does
export const getListHeightTransition = (
  isOpen: boolean,
  reduceMotion?: boolean,
) =>
  reduceMotion
    ? undefined
    : (['smooth', { duration: isOpen ? 250 : LIST_FOLD_MS }] as [
        'smooth',
        { duration: number },
      ]);
export const getListRowMotion = (
  index: number,
  reduceMotion?: boolean,
): Pick<IYStackProps, 'transition' | 'animateOnly' | 'enterStyle'> =>
  reduceMotion
    ? {}
    : {
        // The web driver takes a delay for the whole transition only
        transition: ['fast', { delay: index * LIST_ROW_STAGGER_MS }],
        animateOnly: ANIMATE_ONLY_OPACITY_TRANSFORM,
        enterStyle: LIST_ROW_ENTER_STYLE,
      };
