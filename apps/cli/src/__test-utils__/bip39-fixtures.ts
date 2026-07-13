import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import bip39Vectors from './fixtures/bip39-rfc-vectors.fixture.json';

export type IBip39Fixture = {
  id: string;
  entropyHex: string;
  mnemonic: string;
};

const fixtures = bip39Vectors as IBip39Fixture[];

export function loadBip39Fixtures(): IBip39Fixture[] {
  return fixtures.map((fixture) => ({ ...fixture }));
}

export function getBip39Fixture(id: string): IBip39Fixture {
  const fixture = fixtures.find((item) => item.id === id);
  if (!fixture) {
    throw new OneKeyLocalError(`Unknown BIP-39 fixture: ${id}`);
  }
  return { ...fixture };
}
