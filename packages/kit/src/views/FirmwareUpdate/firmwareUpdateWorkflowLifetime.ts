const FIRMWARE_UPDATE_PAGE_LEAVE_DELAY_MS = 500;

let alivePages = 0;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;

export function resetFirmwareUpdateWorkflowLifetimeForTest() {
  alivePages = 0;
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
  if (alivePages > 0) {
    return;
  }
  if (leaveTimer) {
    clearTimeout(leaveTimer);
  }
  leaveTimer = setTimeout(() => {
    leaveTimer = undefined;
    if (alivePages === 0) {
      void Promise.resolve(onReallyLeave?.());
    }
  }, FIRMWARE_UPDATE_PAGE_LEAVE_DELAY_MS);
}

export function getFirmwareUpdateWorkflowAlivePageCountForTest() {
  return alivePages;
}
