import { useTheme } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import type { ILoanLtvTone } from './loanLtvBar.types';

// One risk language with the Borrow page: "careful" is the theme's own
// yellow, the color the page and every health factor here take, on the LTV
// figure and its bar too. The bar's green and red are ones that sit with it,
// where the theme's fills turn mint and pink; on light its yellow fill is an
// amber, the theme's lemon fading into white. The note under a market card
// that can't take the loan is the same yellow, one step darker on light for
// 4.5:1 on a picked card's grey (4.7 there)
const CAUTION_NOTE_LIGHT = '#955700';
const FILLS = {
  dark: { success: '#34B577', critical: '#EF6062' },
  light: { success: '#2F9E68', caution: '#E5A320', critical: '#E5484D' },
} as const;

// The LTV bar's quiet greys, so the loan's color and the white thumb lead;
// the legend behind the LTV label draws its sample bar from the same
export const LOAN_BAR_SURFACES = {
  dark: {
    track: 'rgba(255, 255, 255, 0.13)',
    locked: 'rgba(255, 255, 255, 0.05)',
    used: 'rgba(255, 255, 255, 0.4)',
    wall: 'rgba(255, 255, 255, 0.55)',
    thumb: '#FFFFFF',
    thumbShadow: '0 0 0 0.5px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.5)',
    // Around the thumb while it is held
    halo: 'rgba(255, 255, 255, 0.16)',
  },
  light: {
    track: 'rgba(0, 0, 0, 0.1)',
    locked: 'rgba(0, 0, 0, 0.04)',
    used: 'rgba(0, 0, 0, 0.3)',
    wall: 'rgba(0, 0, 0, 0.45)',
    thumb: '#FFFFFF',
    thumbShadow:
      '0 0 0 0.5px rgba(0, 0, 0, 0.16), 0 1px 3px rgba(0, 0, 0, 0.18)',
    halo: 'rgba(0, 0, 0, 0.08)',
  },
} as const;

export function useLoanToneColors(): {
  text: Record<ILoanLtvTone, string>;
  fill: Record<ILoanLtvTone, string>;
  note: string;
} {
  const theme = useTheme();
  const isLight = useThemeVariant() === 'light';
  const caution = theme.textCaution.val;
  return {
    text: {
      success: theme.textSuccess.val,
      caution,
      critical: theme.textCritical.val,
    },
    fill: isLight ? FILLS.light : { ...FILLS.dark, caution },
    note: isLight ? CAUTION_NOTE_LIGHT : caution,
  };
}
