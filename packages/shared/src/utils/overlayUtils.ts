export const APP_STATE_LOCK_Z_INDEX = 100_000_000;

export const RESET_OVERLAY_Z_INDEX = APP_STATE_LOCK_Z_INDEX + 2;

// in Tamagui:
//  the z-index of the Sheet is 1e5 - 1.
export const SHEET_AND_DIALOG_Z_INDEX = 100_000 - 1;
//  the z-index of the Dialog is 1e5.
//  the z-index of the Toast is 1e5.
//  the z-index of the Popover 15e4.
export const SHEET_POPOVER_Z_INDEX = 150_000;

export const PASSWORD_VERIFY_CONTAINER_Z_INDEX = 160_000;

//  the z-index of burnt toast is 1e6.
export const TOAST_Z_INDEX = 1_000_000;
