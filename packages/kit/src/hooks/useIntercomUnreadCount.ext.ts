// The extension opens support on the website, so it has no SDK unread state.
export function useIntercomUnreadCount() {
  return 0;
}

// No SDK, so the 0 above is final.
export function useIsIntercomUnreadCountKnown() {
  return true;
}
