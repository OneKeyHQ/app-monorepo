// onekey: injection seam for the OHTTP HPKE suite. Upstream constructed the
// suite inline (internal/ohttp-client.ts:159), which made the WebCrypto
// primitives unswappable. The platform file supplies the default; a host can
// override it (offscreen document, web-embed, tests) before the first OHTTP call.
import { createPlatformHpkeSuite } from './hpkeSuite';

import type { CipherSuite } from 'hpke';

export type HpkeSuiteFactory = () => CipherSuite;

let overrideFactory: HpkeSuiteFactory | undefined;

/** Replace the platform default. Pass `undefined` to restore it. */
export function setHpkeSuiteFactory(
  factory: HpkeSuiteFactory | undefined,
): void {
  overrideFactory = factory;
}

/** Build the HPKE suite for one OHTTP client. */
export function createHpkeSuite(): CipherSuite {
  return (overrideFactory ?? createPlatformHpkeSuite)();
}
