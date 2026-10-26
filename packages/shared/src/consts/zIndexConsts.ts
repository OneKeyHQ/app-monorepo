// Overlays stack by their native overlay level
// (`@onekeyfe/react-native-native-overlay`); these are in-page layers only.

// A drag clone (web) renders above the `modal` overlay layer (z-index 1e5),
// so dragging inside a dialog stays visible.
export const DRAG_CLONE_Z_INDEX = 100_001;

export const FLOAT_NAV_BAR_Z_INDEX = 50;
