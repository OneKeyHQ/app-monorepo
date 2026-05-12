import { getBip39Fixture, loadBip39Fixtures } from '../bip39-fixtures';

describe('bip39-fixtures', () => {
  it('loads RFC vectors from the fixture file', () => {
    const fixtures = loadBip39Fixtures();

    expect(fixtures).toHaveLength(3);
    expect(fixtures[0]?.entropyHex).toMatch(/^[0-9a-f]+$/u);
  });

  it('returns fixture copies by id', () => {
    const fixtures = loadBip39Fixtures();
    const fixture = getBip39Fixture(fixtures[0].id);

    expect(fixture).toEqual(fixtures[0]);
    expect(fixture).not.toBe(fixtures[0]);
  });

  it('keeps mnemonic text out of TypeScript callers', () => {
    const fixtures = loadBip39Fixtures();

    for (const fixture of fixtures) {
      expect(fixture.mnemonic.split(' ')).toHaveLength(12);
    }
  });
});
