import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const DEFAULT_CLOSE_ACK_TIMEOUT_MS = 5000;

type ICloseWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class HardwareUiStateDialogLifecycle {
  private isOpen = false;

  private readonly closeWaiters = new Set<ICloseWaiter>();

  constructor(
    private readonly closeAckTimeoutMs = DEFAULT_CLOSE_ACK_TIMEOUT_MS,
  ) {}

  updateOpenState(isOpen: boolean) {
    this.isOpen = isOpen;
    if (isOpen) {
      return;
    }

    for (const waiter of this.closeWaiters) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
    this.closeWaiters.clear();
  }

  async closeAndWait(closeAction: () => Promise<void>) {
    const closeWaiter = this.isOpen ? this.createCloseWaiter() : undefined;

    try {
      await closeAction();
      await closeWaiter?.promise;
    } catch (error) {
      closeWaiter?.cancel();
      throw error;
    }
  }

  private createCloseWaiter() {
    let waiter: ICloseWaiter;
    const promise = new Promise<void>((resolve, reject) => {
      waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.closeWaiters.delete(waiter);
          reject(
            new OneKeyLocalError(
              'Hardware UI dialog close acknowledgement timed out',
            ),
          );
        }, this.closeAckTimeoutMs),
      };
      this.closeWaiters.add(waiter);
    });

    return {
      promise,
      cancel: () => {
        clearTimeout(waiter.timer);
        this.closeWaiters.delete(waiter);
      },
    };
  }
}

export const hardwareUiStateDialogLifecycle =
  new HardwareUiStateDialogLifecycle();
