import { isPassphraseValid } from './passphraseUtils';

const passphraseTests = [
  {
    description: 'empty passphrase in allowExtended',
    passphrase: '',
    allowExtended: true,
    should: true,
  },
  {
    description: 'empty passphrase',
    passphrase: '',
    allowExtended: false,
    should: true,
  },
  {
    description: 'passphrase with only regular visible ASCII characters',
    passphrase: 'ThisIsAPassphrase123',
    allowExtended: true,
    should: true,
  },
  {
    description: 'passphrase with extended ASCII characters in allowExtended',
    passphrase: '¥Øÿ', // 合法的扩展 ASCII 字符
    allowExtended: true,
    should: true,
  },
  {
    description: 'valid passphrase with extended ASCII characters',
    passphrase: 'P@sswôrd€', // 包含 32 - 255 之外的 ASCII 字符
    allowExtended: false,
    should: false,
  },
  {
    description: 'passphrase with space',
    passphrase: 'My Passphrase', // 包含空格
    allowExtended: false,
    should: true,
  },
  {
    description: 'passphrase preceded by a space',
    passphrase: '  Passphrase', // 包含空格
    allowExtended: false,
    should: true,
  },
  {
    description: 'passphrase with invalid characters',
    passphrase: 'Hello!#World',
    allowExtended: true,
    should: true,
  },

  {
    description:
      'passphrase with leading and trailing spaces  in allowExtended',
    passphrase: '   SpacePassword123   ',
    allowExtended: true,
    should: true,
  },
  {
    description: 'passphrase with leading and trailing spaces',
    passphrase: '   SpacePassword123   ',
    allowExtended: false,
    should: true,
  },
  {
    description: 'passphrase with only spaces  in allowExtended',
    passphrase: '         ',
    allowExtended: true,
    should: true,
  },
  {
    description: 'passphrase with only spaces',
    passphrase: '         ',
    allowExtended: false,
    should: true,
  },
  {
    description: 'invalid passphrase with non-ASCII characters',
    passphrase: '私のパスワード',
    allowExtended: false,
    should: false,
  },
  {
    description:
      'invalid passphrase with non-ASCII characters  in allowExtended',
    passphrase: 'myسياسةpassphrase',
    allowExtended: true,
    should: false,
  },
  {
    description: 'valid passphrase with all ASCII characters',
    passphrase: String.fromCharCode(
      ...Array.from({ length: 95 }, (_, i) => i + 32),
    ), // 32 to 126
    allowExtended: false,
    should: true,
  },
  {
    description: 'error valid passphrase with all ASCII characters',
    passphrase: String.fromCharCode(
      ...Array.from({ length: 96 }, (_, i) => i + 32),
    ), // 32 to 127
    allowExtended: false,
    should: false,
  },
  {
    description: 'valid passphrase with all extended ASCII characters',
    passphrase: String.fromCharCode(
      ...Array.from({ length: 224 }, (_, i) => i + 32),
    ), // 32 to 255
    allowExtended: true,
    should: true,
  },
];

describe('Passphrase Utils Tests', () => {
  passphraseTests.forEach((data) => {
    test(data.description, () => {
      const { passphrase, allowExtended, should } = data;
      const result = isPassphraseValid(passphrase, {
        allowExtendedASCII: allowExtended,
      });
      expect(result).toBe(should);
    });
  });
});
