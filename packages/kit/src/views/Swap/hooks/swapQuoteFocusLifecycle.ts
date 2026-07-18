type ISwapQuoteSurfaceVisibility = 'focused' | 'temporarily-hidden' | 'exited';

type ISwapQuoteFocusLifecycleTransition = {
  visibility: ISwapQuoteSurfaceVisibility;
  shouldAttachSessionListeners: boolean;
  shouldDetachSessionListeners: boolean;
  shouldInvalidateIntent: boolean;
  shouldClearUserInput: boolean;
  shouldRefreshPreservedInput: boolean;
  nextShouldRefreshPreservedInput: boolean;
};

export function getSwapQuoteFocusLifecycleTransition({
  hasPendingPreservedInputRefresh,
  isHiddenByOverlay,
  isQuotePaused,
  isTabFocused,
  shouldPreserveUserInputOnExit,
}: {
  hasPendingPreservedInputRefresh: boolean;
  isHiddenByOverlay: boolean;
  isQuotePaused: boolean;
  isTabFocused: boolean;
  shouldPreserveUserInputOnExit: boolean;
}): ISwapQuoteFocusLifecycleTransition {
  if (!isTabFocused) {
    return {
      visibility: 'exited',
      shouldAttachSessionListeners: false,
      shouldDetachSessionListeners: true,
      shouldInvalidateIntent: true,
      shouldClearUserInput: !shouldPreserveUserInputOnExit,
      shouldRefreshPreservedInput: false,
      nextShouldRefreshPreservedInput: shouldPreserveUserInputOnExit,
    };
  }

  if (isHiddenByOverlay) {
    return {
      visibility: 'temporarily-hidden',
      shouldAttachSessionListeners: true,
      shouldDetachSessionListeners: false,
      shouldInvalidateIntent: false,
      shouldClearUserInput: false,
      shouldRefreshPreservedInput: false,
      nextShouldRefreshPreservedInput: hasPendingPreservedInputRefresh,
    };
  }

  return {
    visibility: 'focused',
    shouldAttachSessionListeners: true,
    shouldDetachSessionListeners: false,
    shouldInvalidateIntent: false,
    shouldClearUserInput: false,
    shouldRefreshPreservedInput:
      hasPendingPreservedInputRefresh && !isQuotePaused,
    nextShouldRefreshPreservedInput: false,
  };
}
