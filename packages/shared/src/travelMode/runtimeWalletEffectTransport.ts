export function createRuntimeWalletEffectTransport<T extends object>(
  transport: T,
): T {
  return transport;
}
