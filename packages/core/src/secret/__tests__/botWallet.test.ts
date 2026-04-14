import { InvalidMnemonic, OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  entropyToMnemonic,
  mnemonicToSeedSync,
  validateMnemonic,
} from '../bip39';
import { deriveBotMnemonic } from '../botWallet';
import { hmacSHA512Sync } from '../hash';

const actualBip39: typeof import('../bip39') = jest.requireActual('../bip39');
const actualHash: typeof import('../hash') = jest.requireActual('../hash');

jest.mock('../bip39', () => {
  const actual: typeof import('../bip39') = jest.requireActual('../bip39');

  return {
    ...actual,
    entropyToMnemonic: jest.fn(actual.entropyToMnemonic),
    mnemonicToSeedSync: jest.fn(actual.mnemonicToSeedSync),
    validateMnemonic: jest.fn(actual.validateMnemonic),
  };
});

jest.mock('../hash', () => {
  const actual: typeof import('../hash') = jest.requireActual('../hash');

  return {
    ...actual,
    hmacSHA512Sync: jest.fn(actual.hmacSHA512Sync),
  };
});

const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('deriveBotMnemonic', () => {
  const mockedEntropyToMnemonic = jest.mocked(entropyToMnemonic);
  const mockedMnemonicToSeedSync = jest.mocked(mnemonicToSeedSync);
  const mockedValidateMnemonic = jest.mocked(validateMnemonic);
  const mockedHmacSHA512Sync = jest.mocked(hmacSHA512Sync);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedEntropyToMnemonic.mockImplementation(actualBip39.entropyToMnemonic);
    mockedMnemonicToSeedSync.mockImplementation(actualBip39.mnemonicToSeedSync);
    mockedValidateMnemonic.mockImplementation(actualBip39.validateMnemonic);
    mockedHmacSHA512Sync.mockImplementation(actualHash.hmacSHA512Sync);
  });

  it('should derive a deterministic 12-word bot mnemonic', () => {
    const actual = deriveBotMnemonic(TEST_MNEMONIC, 0);

    let parentSeed: Buffer | undefined;
    let expectedDerived: Buffer | undefined;

    try {
      parentSeed = actualBip39.mnemonicToSeedSync(TEST_MNEMONIC);
      expectedDerived = actualHash.hmacSHA512Sync(
        parentSeed,
        Buffer.from('onekey-bot-wallet-0', 'utf8'),
      );

      const expected = actualBip39.entropyToMnemonic(
        expectedDerived.slice(0, 16),
      );

      expect(actual).toBe(expected);
      expect(actualBip39.validateMnemonic(actual)).toBe(true);
      expect(actual.trim().split(/\s+/)).toHaveLength(12);
    } finally {
      parentSeed?.fill(0);
      expectedDerived?.fill(0);
    }
  });

  it('should derive different mnemonics for different indexes', () => {
    const mnemonic0 = deriveBotMnemonic(TEST_MNEMONIC, 0);
    const mnemonic1 = deriveBotMnemonic(TEST_MNEMONIC, 1);

    expect(mnemonic0).not.toBe(mnemonic1);
    expect(actualBip39.validateMnemonic(mnemonic0)).toBe(true);
    expect(actualBip39.validateMnemonic(mnemonic1)).toBe(true);
  });

  it('should throw InvalidMnemonic for an invalid parent mnemonic', () => {
    expect(() => deriveBotMnemonic('invalid mnemonic', 0)).toThrow(
      InvalidMnemonic,
    );
    expect(mockedMnemonicToSeedSync).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'should reject invalid index %p',
    (invalidIndex) => {
      expect(() => deriveBotMnemonic(TEST_MNEMONIC, invalidIndex)).toThrow(
        'Invalid index.',
      );
      expect(mockedMnemonicToSeedSync).not.toHaveBeenCalled();
    },
  );

  it('should zeroize sensitive buffers on success', () => {
    const parentSeed = Buffer.from(
      actualBip39.mnemonicToSeedSync(TEST_MNEMONIC),
    );
    const derived = Buffer.alloc(64, 7);

    mockedMnemonicToSeedSync.mockReturnValue(parentSeed);
    mockedHmacSHA512Sync.mockReturnValue(derived);

    const botMnemonic = deriveBotMnemonic(TEST_MNEMONIC, 3);

    expect(actualBip39.validateMnemonic(botMnemonic)).toBe(true);
    expect([...parentSeed].every((byte) => byte === 0)).toBe(true);
    expect([...derived].every((byte) => byte === 0)).toBe(true);
  });

  it('should zeroize sensitive buffers when derivation fails after HMAC', () => {
    const parentSeed = Buffer.from(
      actualBip39.mnemonicToSeedSync(TEST_MNEMONIC),
    );
    const derived = Buffer.alloc(64, 9);

    mockedMnemonicToSeedSync.mockReturnValue(parentSeed);
    mockedHmacSHA512Sync.mockReturnValue(derived);
    mockedEntropyToMnemonic.mockImplementation(() => {
      throw new OneKeyLocalError('Entropy conversion failed');
    });

    expect(() => deriveBotMnemonic(TEST_MNEMONIC, 4)).toThrow(
      'Entropy conversion failed',
    );
    expect([...parentSeed].every((byte) => byte === 0)).toBe(true);
    expect([...derived].every((byte) => byte === 0)).toBe(true);
  });
});
