import stringUtils, {
  isCombiningMark,
  isPrintableASCIIString,
  splitGraphemes,
  stableStringify,
} from './stringUtils';

test('stableStringify', () => {
  expect(stableStringify({ a: '1', b: '2' })).toBe(
    stableStringify({ b: '2', a: '1' }),
  );
});

describe('splitGraphemes', () => {
  const withoutSegmenter = (run: () => void) => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    Object.defineProperty(Intl, 'Segmenter', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      run();
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'Segmenter', descriptor);
    }
  };

  test.each([
    ['Intl.Segmenter', (run: () => void) => run()],
    ['the code point fallback', withoutSegmenter],
  ])('never starts a grapheme with a combining mark via %s', (_name, env) => {
    env(() => {
      for (const text of [
        'กำไรขั้นต้น',
        'กำไรสุทธิ',
        'পরিচালন-বহির্ভূত আয়',
        'e\u0301te',
      ]) {
        const graphemes = splitGraphemes(text);
        expect(graphemes.join('')).toBe(text);
        expect(graphemes.filter((item) => /^\p{M}/u.test(item))).toEqual([]);
      }
    });
  });

  test('keeps conjuncts and emoji sequences whole in the fallback', () => {
    withoutSegmenter(() => {
      expect(splitGraphemes('ক্ষমা')).toEqual(['ক্ষ', 'মা']);
      expect(splitGraphemes('👩‍💻!')).toEqual(['👩‍💻', '!']);
    });
  });

  test('isCombiningMark covers Thai tone marks but not base letters', () => {
    expect(isCombiningMark(0x0e_49)).toBe(true);
    expect(isCombiningMark(0x0e_01)).toBe(false);
  });
});

describe('isPrintableASCIIString', () => {
  test.each([
    'OneKeyPro2',
    'OneKey Pro 2',
    'OneKey-Pro2',
    'OneKey_Pro2',
    'ONEKEY',
    '123456',
  ])('%s is valid', (value) => {
    expect(isPrintableASCIIString(value)).toBe(true);
  });

  test.each(['', 'OneKey　Pro2', '一键', '１２３'])(
    '%s is invalid',
    (value) => {
      expect(isPrintableASCIIString(value)).toBe(false);
    },
  );
});

describe('isValidEmail', () => {
  test('should accept valid ASCII domain emails', () => {
    expect(stringUtils.isValidEmail('test@example.com')).toBe(true);
    expect(stringUtils.isValidEmail('user@gmail.com')).toBe(true);
    expect(stringUtils.isValidEmail('hello.world@sub.domain.org')).toBe(true);
    expect(stringUtils.isValidEmail('user+tag@example.co.uk')).toBe(true);
  });

  test('should reject emails with IDN domains (non-ASCII)', () => {
    expect(stringUtils.isValidEmail('test@中文.com')).toBe(false);
    expect(stringUtils.isValidEmail('test@例え.jp')).toBe(false);
    expect(stringUtils.isValidEmail('test@домен.рф')).toBe(false);
    expect(stringUtils.isValidEmail('user@münchen.de')).toBe(false);
  });

  test('should reject invalid emails', () => {
    expect(stringUtils.isValidEmail('')).toBe(false);
    expect(stringUtils.isValidEmail('invalid')).toBe(false);
    expect(stringUtils.isValidEmail('no@domain')).toBe(false);
    expect(stringUtils.isValidEmail('@example.com')).toBe(false);
    expect(stringUtils.isValidEmail('test@')).toBe(false);
  });

  test('should handle edge cases', () => {
    expect(stringUtils.isValidEmail(null as unknown as string)).toBe(false);
    expect(stringUtils.isValidEmail(undefined as unknown as string)).toBe(
      false,
    );
    expect(stringUtils.isValidEmail(123 as unknown as string)).toBe(false);
  });
});
