import { useTheme } from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import type { ILoanLtvTone } from './loanLtvBar.types';

// The theme's caution color is a lemon yellow, harsh on dark and brown on
// white; the router says "careful" in amber instead, on the LTV bar and its
// figure, the Health Factor and the notes on why a market can't take the
// loan. Text keeps the theme's green and red; the bar's fills take a green
// and a red that sit with the amber, where the theme's turn mint and pink
// On light, dark enough for 4.5:1 on a picked card's grey (4.7 there)
const CAUTION_TEXT = { dark: '#F4B740', light: '#955700' } as const;
const FILLS = {
  dark: { success: '#34B577', caution: '#F0B132', critical: '#EF6062' },
  light: { success: '#2F9E68', caution: '#E5A320', critical: '#E5484D' },
} as const;

export function useLoanToneColors(): Record<
  'text' | 'fill',
  Record<ILoanLtvTone, string>
> {
  const theme = useTheme();
  const variant = useThemeVariant() === 'light' ? 'light' : 'dark';
  return {
    text: {
      success: theme.textSuccess.val,
      caution: CAUTION_TEXT[variant],
      critical: theme.textCritical.val,
    },
    fill: FILLS[variant],
  };
}
