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
