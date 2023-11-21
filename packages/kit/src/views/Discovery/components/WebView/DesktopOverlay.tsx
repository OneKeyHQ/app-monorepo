import { memo, useCallback, useEffect, useState } from 'react';

import { Stack } from '@onekeyhq/components';

class DesktopMenuOverlayStatus {
  #isShowOverlay = false;

  #statusChangeListeners: ((isShowOverlay: boolean) => void)[] = [];

  set isShowOverlay(status: boolean) {
    this.#isShowOverlay = status;
    this.#statusChangeListeners.forEach((callback) => {
      callback(status);
    });
  }

  get isShowOverlay() {
    return this.#isShowOverlay;
  }

  onStatusChange(callback: (isShowOverlay: boolean) => void) {
    this.#statusChangeListeners.push(callback);
    callback(this.#isShowOverlay);
    return () => this.removeSubscription(callback);
  }

  removeSubscription(callback: (isShowOverlay: boolean) => void) {
    this.#statusChangeListeners = this.#statusChangeListeners.filter(
      (c) => c === callback,
    );
  }
}

const desktopMenuOverlayStatus = new DesktopMenuOverlayStatus();

function BasicDesktopOverlay() {
  const [isShowOverlay, setOverlayStatus] = useState(false);

  const changeOverlayStatus = useCallback((isOpen: boolean) => {
    setOverlayStatus(isOpen);
  }, []);
  useEffect(() => {
    const subscription =
      desktopMenuOverlayStatus.onStatusChange(changeOverlayStatus);
    return subscription;
  }, [changeOverlayStatus]);
  return isShowOverlay ? (
    <Stack position="absolute" top={0} bottom={0} left={0} right={0} />
  ) : null;
}

export const dispatchOverlayEvent = (isOpen: boolean) => {
  desktopMenuOverlayStatus.isShowOverlay = isOpen;
};

export const DesktopOverlay = memo(BasicDesktopOverlay);
