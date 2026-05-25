export function getEarnFocusState({
  isFocus,
  isHideByModal,
}: {
  isFocus: boolean;
  isHideByModal: boolean;
}) {
  return {
    isVisibleFocus: isFocus && !isHideByModal,
    isDataActive: isFocus,
  };
}
