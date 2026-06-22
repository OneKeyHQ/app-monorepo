export function getEarnFocusState({
  isFocus,
  isHideByModal,
}: {
  isFocus: boolean;
  isHideByModal: boolean;
}) {
  const isVisibleFocus = isFocus && !isHideByModal;

  return {
    isVisibleFocus,
    isDataActive: isVisibleFocus,
  };
}
