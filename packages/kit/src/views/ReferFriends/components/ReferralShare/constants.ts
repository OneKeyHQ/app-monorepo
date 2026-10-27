// The share card is always dark regardless of the app theme, so its colors
// are fixed literals instead of theme tokens.
export const REFERRAL_SHARE_CARD = {
  width: 360,
  backgroundColor: '#0E0E0E',
  footerBackgroundColor: '#1C1C1C',
  paddingX: 28,
  textColor: '#FFFFFF',
  subduedTextColor: 'rgba(255,255,255,0.6)',
  // brand9 in dark mode: reads on the dark card without glowing
  accentColor: '#3EDC2F',
  brand: { logoSize: 28, gap: 8, textSize: 16 },
  headline: { size: 30, lineHeight: 38, gapAbove: 48 },
  code: {
    gapAbove: 40,
    labelSize: 13,
    labelLineHeight: 18,
    size: 26,
    lineHeight: 32,
  },
  footer: {
    gapAbove: 32,
    paddingY: 20,
    titleSize: 15,
    titleLineHeight: 20,
    urlSize: 13,
    urlLineHeight: 18,
    qrSize: 96,
  },
} as const;
