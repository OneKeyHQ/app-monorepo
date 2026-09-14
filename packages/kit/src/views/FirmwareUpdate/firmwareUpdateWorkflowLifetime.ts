import { EFirmwareUpdateSteps } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const FIRMWARE_UPDATE_PAGE_LEAVE_DELAY_MS = 500;

let alivePages = 0;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
const pendingLeaveCallbacks: Array<() => void | Promise<void>> = [];

export function resetFirmwareUpdateWorkflowLifetimeForTest() {
  alivePages = 0;
  pendingLeaveCallbacks.length = 0;
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = undefined;
  }
}

export function retainFirmwareUpdateWorkflowPage() {
  alivePages += 1;
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = undefined;
  }
}

export function releaseFirmwareUpdateWorkflowPage(
  onReallyLeave?: () => void | Promise<void>,
) {
  alivePages = Math.max(0, alivePages - 1);
  if (onReallyLeave) {
    pendingLeaveCallbacks.push(onReallyLeave);
  }
  if (alivePages > 0) {
    return;
  }
  if (leaveTimer) {
    clearTimeout(leaveTimer);
  }
  leaveTimer = setTimeout(() => {
    leaveTimer = undefined;
    if (alivePages === 0) {
      const callbacks = pendingLeaveCallbacks.splice(0);
      void Promise.all(
        callbacks.map((callback) => Promise.resolve(callback())),
      );
    }
  }, FIRMWARE_UPDATE_PAGE_LEAVE_DELAY_MS);
}

export function getFirmwareUpdateWorkflowAlivePageCountForTest() {
  return alivePages;
}

export async function shouldCancelDeviceWhenLeavingFirmwareUpdate(
  isExtension: boolean,
  getCurrentStep: () => Promise<EFirmwareUpdateSteps>,
) {
  if (!isExtension) {
    return true;
  }
  return (await getCurrentStep()) !== EFirmwareUpdateSteps.updateDone;
}
