import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const DEFAULT_STATE_ACK_TIMEOUT_MS = 5000;
// Dialog.show keeps its portal mounted for 300 ms while the native Sheet exits.
// Treating the React state commit as "closed" lets the next Sheet mount inside
// that exit window, which can leave the old iOS overlay intercepting touches.
const DEFAULT_CLOSE_SETTLE_MS = 300;

type IStateWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class HardwareUiStateDialogLifecycle {
  private isOpen = false;

  private closeSettleTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly openWaiters = new Set<IStateWaiter>();

  private readonly closeWaiters = new Set<IStateWaiter>();

  constructor(
    private readonly stateAckTimeoutMs = DEFAULT_STATE_ACK_TIMEOUT_MS,
    private readonly closeSettleMs = DEFAULT_CLOSE_SETTLE_MS,
  ) {}

  updateOpenState(isOpen: boolean) {
    clearTimeout(this.closeSettleTimer);
    this.closeSettleTimer = undefined;

    if (isOpen) {
      this.isOpen = true;
      this.resolveWaiters(this.openWaiters);
      return;
    }

    if (!this.isOpen) {
      this.resolveWaiters(this.closeWaiters);
      return;
    }

    this.closeSettleTimer = setTimeout(() => {
      this.closeSettleTimer = undefined;
      this.isOpen = false;
      this.resolveWaiters(this.closeWaiters);
    }, this.closeSettleMs);
  }

  async openAndWait(openAction: () => Promise<void>) {
    const openWaiter = this.isOpen
      ? undefined
      : this.createStateWaiter(
          this.openWaiters,
          'Hardware UI dialog open acknowledgement timed out',
        );

    try {
      await openAction();
      await openWaiter?.promise;
    } catch (error) {
      openWaiter?.cancel();
      throw error;
    }
  }

  async closeAndWait(closeAction: () => Promise<void>) {
    const closeWaiter = this.isOpen
      ? this.createStateWaiter(
          this.closeWaiters,
          'Hardware UI dialog close acknowledgement timed out',
        )
      : undefined;

    try {
      await closeAction();
      await closeWaiter?.promise;
    } catch (error) {
      closeWaiter?.cancel();
      throw error;
    }
  }

  private resolveWaiters(waiters: Set<IStateWaiter>) {
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
    waiters.clear();
  }

  private createStateWaiter(
    waiters: Set<IStateWaiter>,
    timeoutMessage: string,
  ) {
    let waiter: IStateWaiter;
    const promise = new Promise<void>((resolve, reject) => {
      waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          waiters.delete(waiter);
          reject(new OneKeyLocalError(timeoutMessage));
        }, this.stateAckTimeoutMs),
      };
      waiters.add(waiter);
    });

    return {
      promise,
      cancel: () => {
        clearTimeout(waiter.timer);
        waiters.delete(waiter);
      },
    };
  }
}

export const hardwareUiStateDialogLifecycle =
  new HardwareUiStateDialogLifecycle();
