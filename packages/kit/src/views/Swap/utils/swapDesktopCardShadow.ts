// Desktop Swap surfaces float every panel — Swap, Limit, the provider list and
// the Stocks market / trade / positions cards — on one shared halo, so switching
// the Swap / Stocks / Limit tabs never changes how a card sits on the page.
// Keep all of them on these values instead of copying the shadow inline.
export const SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE = {
  boxShadow: '0px 0px 24px 0px rgba(0, 0, 0, 0.06)',
} as const;

export const SWAP_DESKTOP_CARD_SHADOW_NATIVE_STYLE = {
  shadowColor: 'rgba(0, 0, 0, 0.08)',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 1,
  shadowRadius: 24,
} as const;
