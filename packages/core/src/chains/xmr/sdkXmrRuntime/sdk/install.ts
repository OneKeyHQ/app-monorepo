import { getXmrRuntimeApiForCarrier } from '.';

import { setXmrRuntimeApiLoader } from '..';
import { setXmrRuntimeLoader } from '../address';

/**
 * Point every Monero entry point at this platform's carrier.
 *
 * Two loaders, one module: the wallet API (scanning, balances, sending) and
 * the pure API (address derivation, signing). They share a runtime because
 * there is no reason to instantiate wasm twice — deriving an address does not
 * start a scan, but it does not need its own module either.
 *
 * Both must be installed, not just the wallet one. On iOS and Android the
 * background is Hermes and cannot execute wasm at all, so the in-process
 * fallback in `address.ts` would fail there; derivation has to cross to the
 * web-embed like everything else.
 *
 * Safe to call more than once: installing a loader replaces the previous one
 * and the carrier itself caches its instantiation.
 */
export function installXmrCarrier(): void {
  setXmrRuntimeApiLoader(getXmrRuntimeApiForCarrier);
  setXmrRuntimeLoader(async () => {
    const api = await getXmrRuntimeApiForCarrier();
    return {
      deriveAccount: api.deriveAccount,
      deriveSubaddress: api.deriveSubaddress,
      validateAddress: api.validateAddress,
      spendScalar: api.spendScalar,
      signTransaction: api.signTransaction,
      verifyTransaction: api.verifyTransaction,
    };
  });
}
