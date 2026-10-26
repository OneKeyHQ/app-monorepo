export class ControlledWalletConnectSocket {
  static instances: ControlledWalletConnectSocket[] = [];

  static behavior: 'hang' | 'fail' | 'open' = 'hang';

  readyState = 0;

  closeCalls = 0;

  onopen?: () => void;

  onclose?: () => void;

  onerror?: (event: { error: Error }) => void;

  onmessage?: (event: { data: string }) => void;

  constructor(readonly url: string) {
    ControlledWalletConnectSocket.instances.push(this);
    const behavior = ControlledWalletConnectSocket.behavior;
    if (behavior !== 'hang') {
      setTimeout(() => {
        if (behavior === 'open') this.finishOpen();
        else this.onerror?.({ error: new Error('Synthetic socket failure') });
      }, 0);
    }
  }

  finishOpen() {
    this.readyState = 1;
    this.onopen?.();
  }

  close() {
    this.closeCalls += 1;
    this.readyState = 3;
    // Native closure acknowledgment may never arrive on an unreachable relay.
  }

  send() {}
}
