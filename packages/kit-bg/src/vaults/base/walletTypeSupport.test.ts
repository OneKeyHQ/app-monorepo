import { keyringMapSupportsAccount } from './walletTypeSupport';

import type { KeyringBase } from './KeyringBase';
import type { IKeyringMap } from './VaultBase';

const SOME_KEYRING = class {} as unknown as typeof KeyringBase;

function buildMap(overrides: Partial<IKeyringMap>): IKeyringMap {
  return {
    hd: undefined,
    qr: undefined,
    hw: undefined,
    imported: undefined,
    watching: undefined,
    external: undefined,
    ...overrides,
  };
}

const HD = "hd-1--m/44'/128'/0'";
const HW = "hw-2c435a9b--m/44'/128'/0'";
const QR = "qr-1--m/44'/0'/0'";
const IMPORTED = "imported--128--m/44'/128'/0'";
const WATCHING = "watching--128--m/44'/128'/0'";

describe('keyringMapSupportsAccount', () => {
  /**
   * Monero's shape: software wallets only. `hd-core` exposes no Monero
   * methods, so the chain declares no hardware keyring -- and the UI must
   * withhold the scan toggle rather than offer it and be refused on press.
   */
  it('reports a chain with only an hd keyring as software-only', () => {
    const keyringMap = buildMap({ hd: SOME_KEYRING });
    expect(keyringMapSupportsAccount({ keyringMap, accountId: HD })).toBe(true);
    expect(keyringMapSupportsAccount({ keyringMap, accountId: HW })).toBe(
      false,
    );
    expect(keyringMapSupportsAccount({ keyringMap, accountId: QR })).toBe(
      false,
    );
    expect(keyringMapSupportsAccount({ keyringMap, accountId: IMPORTED })).toBe(
      false,
    );
    expect(keyringMapSupportsAccount({ keyringMap, accountId: WATCHING })).toBe(
      false,
    );
  });

  it('accepts a hardware account when any vendor keyring is declared', () => {
    expect(
      keyringMapSupportsAccount({
        keyringMap: buildMap({ hw: SOME_KEYRING }),
        accountId: HW,
      }),
    ).toBe(true);
    // A chain that only implements a third-party vendor still serves
    // hardware; which vendor is decided later, from the device row.
    expect(
      keyringMapSupportsAccount({
        keyringMap: buildMap({ hwLedger: SOME_KEYRING }),
        accountId: HW,
      }),
    ).toBe(true);
    expect(
      keyringMapSupportsAccount({
        keyringMap: buildMap({ hwTrezor: SOME_KEYRING }),
        accountId: HW,
      }),
    ).toBe(true);
  });

  it('does not let one wallet type vouch for another', () => {
    const keyringMap = buildMap({ watching: SOME_KEYRING });
    expect(keyringMapSupportsAccount({ keyringMap, accountId: WATCHING })).toBe(
      true,
    );
    expect(keyringMapSupportsAccount({ keyringMap, accountId: HD })).toBe(
      false,
    );
  });
});
