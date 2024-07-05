import type { IDialogInstance, IToastShowResult } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IHardwareUiState } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  CLOSE_ACTION_MIN_DURATION,
  OPEN_ACTION_MIN_DURATION,
} from './constants';

const autoClosedFlag = 'autoClosed';

type IAction = {
  state: IHardwareUiState | undefined;
  action: () => IDialogInstance | IToastShowResult;
};
export default class ActionsQueueManager {
  private tag: string;

  constructor(tag: string) {
    this.tag = tag;
  }

  private queue: (() => IAction)[] = [];

  private isProcessing = false;

  private currentAction?: IDialogInstance | IToastShowResult = undefined;

  public currentActionState?: IHardwareUiState = undefined;

  private toastOpenTime: number | undefined = undefined;

  private lastCloseTime: number | undefined = undefined;

  async log(message?: any, ...optionalParams: any[]) {
    const devSetting =
      await backgroundApiProxy.serviceDevSetting.getDevSetting();
    if (devSetting) {
      console.log(
        `[ActionsQueueManager] ${this.tag} action `,
        message,
        optionalParams,
      );
    }
  }

  addQueue(actionCreator: () => IAction) {
    this.queue.push(actionCreator);
    void this.processQueue();
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const actionCreator = this.queue?.pop();
      // Clear the rest of the queue
      this.queue = [];

      // Close the previous action if it exists
      if (this.currentAction) {
        await this.closeCurrentAction();
      }

      // Ensure minimum time between close and open
      await this.ensureMinimumInterval();

      // Create and show the new action
      const createAction = actionCreator?.();
      this.currentAction = createAction?.action();
      this.currentActionState = createAction?.state;
      this.toastOpenTime = Date.now();
      void this.log('show ', {
        currentActionState: this.currentActionState?.action,
        toastOpenTime: this.toastOpenTime,
        queue: this.queue.length,
      });

      // Wait for the minimum duration
      await new Promise((resolve) =>
        setTimeout(resolve, OPEN_ACTION_MIN_DURATION),
      );
    }

    this.isProcessing = false;
  }

  private async closeCurrentAction() {
    if (this.currentAction && this.toastOpenTime) {
      const elapsedTime = Date.now() - this.toastOpenTime;
      if (elapsedTime < OPEN_ACTION_MIN_DURATION) {
        await timerUtils.wait(OPEN_ACTION_MIN_DURATION - elapsedTime);
      }

      if (this.currentAction) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await this.currentAction?.close?.({ flag: autoClosedFlag });
        this.lastCloseTime = Date.now();
        void this.log('close ', {
          currentActionState: this.currentActionState?.action,
          toastCloseTime: this.lastCloseTime,
          queue: this.queue.length,
        });
        this.currentAction = undefined;
        this.currentActionState = undefined;
        this.toastOpenTime = undefined;
      }
    }
  }

  private async ensureMinimumInterval() {
    if (this.lastCloseTime) {
      const timeSinceLastClose = Date.now() - this.lastCloseTime;
      if (timeSinceLastClose < CLOSE_ACTION_MIN_DURATION) {
        const waitTime = CLOSE_ACTION_MIN_DURATION - timeSinceLastClose;
        await timerUtils.wait(waitTime);
      }
    }
  }

  async closeAll() {
    this.queue = []; // Clear the queue
    await this.closeCurrentAction();
  }
}
