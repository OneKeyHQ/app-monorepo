import { isPassphraseValid } from './passphraseUtils';

const passphraseTests = [
  {
    description: 'empty passphrase',
    passphrase: '',
    onDevice: false,
    should: true,
  },
  {
    description: 'empty passphrase on device',
    passphrase: '',
    onDevice: true,
    should: true,
  },
  {
    description: 'passphrase with only regular visible ASCII characters',
    passphrase: 'ThisIsAPassphrase123',
    onDevice: false,
    should: true,
  },
  {
    description: 'passphrase with extended ASCII characters',
    passphrase: '¥Øÿ', // 合法的扩展 ASCII 字符
    onDevice: false,
    should: true,
  },
  {
    description: 'valid passphrase with extended ASCII characters on device',
    passphrase: 'P@sswôrd€', // 包含错误 ASCII 字符
    onDevice: true,
    should: false,
  },
  {
    description: 'passphrase with space',
    passphrase: 'My Passphrase', // 包含空格
    onDevice: true,
    should: true,
  },
  {
    description: 'passphrase preceded by a space',
    passphrase: '  Passphrase', // 包含空格
    onDevice: true,
    should: true,
  },
  {
    description: 'passphrase with invalid characters',
    passphrase: 'Hello!#World',
    onDevice: false,
    should: true,
  },

  {
    description: 'passphrase with leading and trailing spaces',
    passphrase: '   SpacePassword123   ',
    onDevice: false,
    should: true,
  },
  {
    description: 'passphrase with leading and trailing spaces on device',
    passphrase: '   SpacePassword123   ',
    onDevice: true,
    should: true,
  },
  {
    description: 'passphrase with only spaces',
    passphrase: '         ',
    onDevice: false,
    should: true,
  },
  {
    description: 'passphrase with only spaces on device',
    passphrase: '         ',
    onDevice: true,
    should: true,
  },
  {
    description: 'invalid passphrase with non-ASCII characters on device',
    passphrase: '私のパスワード',
    onDevice: true,
    should: false,
  },
  {
    description: 'invalid passphrase with non-ASCII characters',
    passphrase: 'myسياسةpassphrase',
    onDevice: false,
    should: false,
  },
  {
    description: 'valid passphrase with all ASCII characters on device',
    passphrase: String.fromCharCode(
      ...Array.from({ length: 96 }, (_, i) => i + 32),
    ), // 32 to 127
    onDevice: true,
    should: true,
  },
  {
    description: 'valid passphrase with all extended ASCII characters',
    passphrase: String.fromCharCode(
      ...Array.from({ length: 224 }, (_, i) => i + 32),
    ), // 32 to 255
    onDevice: false,
    should: true,
  },
];

describe('Passphrase Utils Tests', () => {
  passphraseTests.forEach((data) => {
    test(data.description, () => {
      const { passphrase, onDevice, should } = data;
      const result = isPassphraseValid(passphrase, {
        onDevice,
      });
      expect(result).toBe(should);
    });
  });
});
