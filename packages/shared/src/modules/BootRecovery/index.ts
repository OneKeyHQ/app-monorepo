// Desktop/Web: recovery is handled via desktopApi IPC, not native module
const BootRecovery = {
  markBootSuccess(): void {
    globalThis.desktopApi?.markBootSuccess?.();
  },
  setConsecutiveBootFailCount(count: number): void {
    globalThis.desktopApi?.setConsecutiveBootFailCount?.(count);
  },
  async getAndClearRecoveryAction(): Promise<string> {
    // Desktop reports Sentry directly from main process, no JS-layer flag needed
    return '';
  },
};

export default BootRecovery;
