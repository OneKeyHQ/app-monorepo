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

export type IEarnPageBannerLoadStatus =
  | 'loading'
  | 'resolved'
  | 'retryableError';

export function getNextEarnPageBannerLoadStatus({
  currentStatus,
  event,
}: {
  currentStatus: IEarnPageBannerLoadStatus;
  event: 'requestStarted' | 'requestResolved' | 'requestFailed';
}): IEarnPageBannerLoadStatus {
  if (event === 'requestResolved') {
    return 'resolved';
  }
  if (currentStatus === 'resolved') {
    return currentStatus;
  }
  return event === 'requestStarted' ? 'loading' : 'retryableError';
}
