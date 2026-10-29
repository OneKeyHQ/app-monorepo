import type { IXmrPureRuntimeApi } from './address';

// Node and tests only. The app installs its carrier first (installXmrCarrier);
// its platform files keep this in-process copy of the runtime out of the bundle.
export async function loadXmrPureRuntimeInProcess(): Promise<IXmrPureRuntimeApi> {
  const { loadXmrRuntime } = await import('./carrier/loadRuntime');
  const api = await loadXmrRuntime();
  return {
    deriveAccount: api.deriveAccount,
    deriveSubaddress: api.deriveSubaddress,
    validateAddress: api.validateAddress,
    signTransactionWithBip32Key: api.signTransactionWithBip32Key,
    verifyTransaction: api.verifyTransaction,
  };
}
