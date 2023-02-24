declare module 'monero-javascript' {
  class MoneroWalletFull {}

  export function openWalletFull(...args: any[]): Promise<MoneroWalletFull>;
  export function createWalletFull(...args: any[]): Promise<MoneroWalletFull>;
}
