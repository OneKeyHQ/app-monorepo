import { getXmrRuntimeApiForCarrier } from '.';

import { setXmrRuntimeApiLoader } from '..';
import { setXmrRuntimeLoader } from '../address';

/**
 * Points both the wallet API and the pure API at this platform's carrier.
 * Both are required: on Hermes the in-process fallback in `address.ts` cannot
 * run wasm. Idempotent.
 */
export function installXmrCarrier(): void {
  setXmrRuntimeApiLoader(getXmrRuntimeApiForCarrier);
  setXmrRuntimeLoader(async () => {
    const api = await getXmrRuntimeApiForCarrier();
    return {
      deriveAccount: api.deriveAccount,
      deriveSubaddress: api.deriveSubaddress,
      validateAddress: api.validateAddress,
      signTransactionWithBip32Key: api.signTransactionWithBip32Key,
      verifyTransaction: api.verifyTransaction,
    };
  });
}
