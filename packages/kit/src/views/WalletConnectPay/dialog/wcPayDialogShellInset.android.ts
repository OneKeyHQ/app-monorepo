// On Android the sheet only pads the navigation-bar inset: a separate system
// region under 3-button navigation and a thin strip under gestures, so the
// footer sat flush against the sheet's edge (OK-65646). Keep the native
// Dialog's default 20 under the footer, like every other sheet.
export const WC_PAY_SHELL_CONTENT_BOTTOM_INSET: '$0' | '$5' | '$6' = '$5';
