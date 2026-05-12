type IVoidAsyncFn = () => Promise<void> | void;

export function openKeylessAutoConnectAfterDelay({
  openKeylessAutoConnectDappModal,
  modalDelayMs = 600,
}: {
  openKeylessAutoConnectDappModal: IVoidAsyncFn;
  modalDelayMs?: number;
}) {
  setTimeout(() => {
    void openKeylessAutoConnectDappModal();
  }, modalDelayMs);
}

export function closePageAndOpenKeylessAutoConnect({
  closePage,
  openKeylessAutoConnectDappModal,
  modalDelayMs = 600,
}: {
  closePage: () => void;
  openKeylessAutoConnectDappModal: IVoidAsyncFn;
  modalDelayMs?: number;
}) {
  closePage();
  openKeylessAutoConnectAfterDelay({
    openKeylessAutoConnectDappModal,
    modalDelayMs,
  });
}

export function scheduleFinalizeCloseAndKeylessAutoConnect({
  closePage,
  openKeylessAutoConnectDappModal,
  closeDelayMs = 1000,
  modalDelayMs = 600,
}: {
  closePage: () => void;
  openKeylessAutoConnectDappModal: IVoidAsyncFn;
  closeDelayMs?: number;
  modalDelayMs?: number;
}) {
  setTimeout(() => {
    closePageAndOpenKeylessAutoConnect({
      closePage,
      openKeylessAutoConnectDappModal,
      modalDelayMs,
    });
  }, closeDelayMs);
}
