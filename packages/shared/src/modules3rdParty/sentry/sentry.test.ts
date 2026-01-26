import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { buildBasicOptions, testUtils } from './basicOptions';

const {
  checkPrivateKey,
  checkAndRedactMnemonicWords,
  sanitizeText,
  sanitizeStacktrace,
  isFilterErrorAndSkipSentry,
} = testUtils;

// Test private keys (real format, fake values)
const TEST_ETH_PRIVATE_KEY =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const TEST_RAW_HEX_KEY =
  'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const TEST_BTC_WIF_KEY_5 =
  '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
const TEST_BTC_WIF_KEY_K =
  'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn';
const TEST_BTC_WIF_KEY_L =
  'L1aW4aubDFB7yfras2S1mN3bqg9nwySY8nkoLmJebSLD5BWv3ENZ';
const TEST_EXTENDED_KEY =
  'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

// Test mnemonic words (from BIP39 English wordlist)
const TEST_MNEMONIC_12 =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const TEST_MNEMONIC_3 = 'abandon ability able';

describe('checkPrivateKey', () => {
  test('should detect Ethereum private key with 0x prefix', () => {
    expect(checkPrivateKey(TEST_ETH_PRIVATE_KEY)).toBe(true);
  });

  test('should detect raw 64-char hex private key', () => {
    expect(checkPrivateKey(TEST_RAW_HEX_KEY)).toBe(true);
  });

  test('should detect Bitcoin WIF format (starting with 5)', () => {
    expect(checkPrivateKey(TEST_BTC_WIF_KEY_5)).toBe(true);
  });

  test('should detect Bitcoin WIF format (starting with K)', () => {
    expect(checkPrivateKey(TEST_BTC_WIF_KEY_K)).toBe(true);
  });

  test('should detect Bitcoin WIF format (starting with L)', () => {
    expect(checkPrivateKey(TEST_BTC_WIF_KEY_L)).toBe(true);
  });

  test('should detect 128-char extended key', () => {
    expect(checkPrivateKey(TEST_EXTENDED_KEY)).toBe(true);
  });

  test('should NOT detect short strings', () => {
    expect(checkPrivateKey('short')).toBe(false);
    expect(checkPrivateKey('1234567890')).toBe(false);
  });

  test('should NOT detect normal long strings', () => {
    expect(checkPrivateKey('this is a normal error message that is long')).toBe(
      false,
    );
  });

  test('should handle non-string input', () => {
    expect(checkPrivateKey(null as any)).toBe(false);
    expect(checkPrivateKey(undefined as any)).toBe(false);
    expect(checkPrivateKey(123 as any)).toBe(false);
  });
});

describe('checkAndRedactMnemonicWords', () => {
  test('should redact 3+ consecutive mnemonic words', () => {
    const words = TEST_MNEMONIC_3.split(' ');
    const result = checkAndRedactMnemonicWords(words);
    expect(result).toEqual(['****', '****', '****']);
  });

  test('should redact 12 consecutive mnemonic words', () => {
    const words = TEST_MNEMONIC_12.split(' ');
    const result = checkAndRedactMnemonicWords(words);
    expect(result.every((w) => w === '****')).toBe(true);
  });

  test('should redact mnemonic words in the middle of text', () => {
    // "test123" is not a BIP39 word, so it breaks the sequence
    const words = ['test123', 'abandon', 'ability', 'able', 'failed'];
    const result = checkAndRedactMnemonicWords(words);
    expect(result).toEqual(['test123', '****', '****', '****', 'failed']);
  });

  test('should redact mnemonic words at the end of text', () => {
    // Use non-BIP39 words at the start
    const words = ['abc123', 'def456', 'abandon', 'ability', 'able'];
    const result = checkAndRedactMnemonicWords(words);
    expect(result).toEqual(['abc123', 'def456', '****', '****', '****']);
  });

  test('should NOT redact less than 3 consecutive mnemonic words', () => {
    // Use non-BIP39 words to break the sequence
    const words = ['xyz123', 'abandon', 'ability', 'xyz456'];
    const result = checkAndRedactMnemonicWords(words);
    // Only 2 consecutive mnemonic words, should NOT be redacted
    expect(result).toEqual(['xyz123', 'abandon', 'ability', 'xyz456']);
  });

  test('should handle multiple separate mnemonic sequences', () => {
    // Note: "error" is actually a BIP39 word, so use "failed" instead
    const words = [
      'abandon',
      'ability',
      'able',
      'failed',
      'about',
      'above',
      'absent',
    ];
    const result = checkAndRedactMnemonicWords(words);
    expect(result).toEqual([
      '****',
      '****',
      '****',
      'failed',
      '****',
      '****',
      '****',
    ]);
  });

  test('should handle empty array', () => {
    expect(checkAndRedactMnemonicWords([])).toEqual([]);
  });

  test('should handle non-array input', () => {
    expect(checkAndRedactMnemonicWords(null as any)).toBe(null);
    expect(checkAndRedactMnemonicWords(undefined as any)).toBe(undefined);
  });

  test('should be case-insensitive', () => {
    const words = ['ABANDON', 'Ability', 'able'];
    const result = checkAndRedactMnemonicWords(words);
    expect(result).toEqual(['****', '****', '****']);
  });
});

describe('sanitizeText', () => {
  test('should sanitize private key in error message', () => {
    const text = `Failed to sign: ${TEST_ETH_PRIVATE_KEY}`;
    const result = sanitizeText(text);
    expect(result).toBe('Failed to sign: ****');
  });

  test('should sanitize mnemonic in error message', () => {
    const text = `Invalid mnemonic: ${TEST_MNEMONIC_3}`;
    const result = sanitizeText(text);
    expect(result).toBe('Invalid mnemonic: **** **** ****');
  });

  test('should sanitize both private key and mnemonic', () => {
    const text = `Key: ${TEST_RAW_HEX_KEY} Mnemonic: ${TEST_MNEMONIC_3}`;
    const result = sanitizeText(text);
    expect(result).toBe('Key: **** Mnemonic: **** **** ****');
  });

  test('should NOT modify normal error messages', () => {
    const text = 'Network error: connection timeout';
    const result = sanitizeText(text);
    expect(result).toBe(text);
  });

  test('should handle empty string', () => {
    expect(sanitizeText('')).toBe('');
  });

  test('should handle non-string input', () => {
    expect(sanitizeText(null as any)).toBe(null);
    expect(sanitizeText(undefined as any)).toBe(undefined);
  });

  test('should redact words longer than 20 characters', () => {
    // Create a word that is exactly 21 characters (> 20)
    const longWord = 'a'.repeat(21);
    const text = `Error with token ${longWord} in request`;
    const result = sanitizeText(text);
    expect(result).toBe('Error with token *** in request');
  });

  test('should NOT redact words exactly 20 characters', () => {
    // Create a word that is exactly 20 characters
    const exactWord = 'a'.repeat(20);
    const text = `Token is ${exactWord} here`;
    const result = sanitizeText(text);
    expect(result).toBe(text); // Should not be modified
  });

  test('should redact multiple long words', () => {
    const longWord1 = 'abcdefghijklmnopqrstuvwxyz'; // 26 chars
    const longWord2 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // 26 chars
    const text = `First: ${longWord1} Second: ${longWord2}`;
    const result = sanitizeText(text);
    expect(result).toBe('First: *** Second: ***');
  });

  test('should redact long words that look like tokens or API keys', () => {
    const apiKey = 'fake_test_ef456ghi789jkl012mno345';
    const text = `API call failed with key ${apiKey}`;
    const result = sanitizeText(text);
    expect(result).toBe('API call failed with key ***');
  });
});

describe('sanitizeStacktrace', () => {
  test('should sanitize string variables in stacktrace', () => {
    const stacktrace: any = {
      frames: [
        {
          vars: {
            privateKey: TEST_ETH_PRIVATE_KEY,
            normalVar: 'hello',
          },
        },
      ],
    };
    sanitizeStacktrace(stacktrace);
    expect(stacktrace.frames[0].vars.privateKey).toBe('****');
    expect(stacktrace.frames[0].vars.normalVar).toBe('hello');
  });

  test('should redact objects containing sensitive data', () => {
    // Object with private key as a space-separated value
    const stacktrace: any = {
      frames: [
        {
          vars: {
            config: { key: `secret ${TEST_ETH_PRIVATE_KEY} data` },
          },
        },
      ],
    };
    sanitizeStacktrace(stacktrace);
    expect(stacktrace.frames[0].vars.config).toBe('[REDACTED]');
  });

  test('should sanitize context_line with space-separated key', () => {
    // Key must be space-separated to be detected
    const stacktrace: any = {
      frames: [
        {
          context_line: `const key = ${TEST_RAW_HEX_KEY} // private`,
        },
      ],
    };
    sanitizeStacktrace(stacktrace);
    expect(stacktrace.frames[0].context_line).toBe(
      'const key = **** // private',
    );
  });

  test('should sanitize pre_context and post_context', () => {
    // Mnemonic and keys must be space-separated to be detected
    // Note: "end" is a BIP39 word, use "xyz" instead
    const stacktrace: any = {
      frames: [
        {
          pre_context: [`mnemonic: ${TEST_MNEMONIC_3} xyz`],
          post_context: [`key: ${TEST_ETH_PRIVATE_KEY} xyz`],
        },
      ],
    };
    sanitizeStacktrace(stacktrace);
    expect(stacktrace.frames[0].pre_context[0]).toBe(
      'mnemonic: **** **** **** xyz',
    );
    expect(stacktrace.frames[0].post_context[0]).toBe('key: **** xyz');
  });

  test('should handle undefined stacktrace', () => {
    expect(() => sanitizeStacktrace(undefined)).not.toThrow();
  });

  test('should handle stacktrace without frames', () => {
    expect(() => sanitizeStacktrace({} as any)).not.toThrow();
  });

  test('should handle frames without vars', () => {
    const stacktrace: any = {
      frames: [{ filename: 'test.js' }],
    };
    expect(() => sanitizeStacktrace(stacktrace)).not.toThrow();
  });
});

describe('integration: full error sanitization', () => {
  test('should sanitize complex error with mnemonic leak', () => {
    const errorMessage = `Wallet creation failed. Seed: ${TEST_MNEMONIC_12}. Please try again.`;
    const result = sanitizeText(errorMessage);
    // Note: 'accident.' (with period) doesn't match BIP39 wordlist, so only 11 words are redacted
    expect(result).toBe(
      'Wallet creation failed. Seed: **** **** **** **** **** **** **** **** **** **** **** accident. Please try again.',
    );
  });

  test('should sanitize error with multiple private keys', () => {
    const errorMessage = `Keys: ${TEST_ETH_PRIVATE_KEY} and ${TEST_RAW_HEX_KEY}`;
    const result = sanitizeText(errorMessage);
    expect(result).toBe('Keys: **** and ****');
  });

  test('should handle real-world error format', () => {
    const errorMessage = `TransactionError: Failed to sign transaction with key 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef for address 0x1234`;
    const result = sanitizeText(errorMessage);
    // Private key is redacted, short address is preserved
    expect(result).toBe(
      'TransactionError: Failed to sign transaction with key **** for address 0x1234',
    );
  });
});

describe('isFilterErrorAndSkipSentry', () => {
  describe('filter by error type', () => {
    test('should filter AxiosError', () => {
      expect(isFilterErrorAndSkipSentry({ type: 'AxiosError' })).toBe(true);
    });

    test('should filter HTTPClientError', () => {
      expect(isFilterErrorAndSkipSentry({ type: 'HTTPClientError' })).toBe(
        true,
      );
    });

    test('should filter OneKeyError types', () => {
      // Test via function behavior, not constant
      expect(isFilterErrorAndSkipSentry({ type: 'OneKeyError' })).toBe(true);
      expect(isFilterErrorAndSkipSentry({ type: 'OneKeyLocalError' })).toBe(
        true,
      );
    });

    test('should NOT filter unknown error types', () => {
      expect(isFilterErrorAndSkipSentry({ type: 'UnknownError' })).toBe(false);
      expect(isFilterErrorAndSkipSentry({ type: 'TypeError' })).toBe(false);
    });
  });

  describe('filter by error value', () => {
    test('should filter AbortError: AbortError', () => {
      expect(
        isFilterErrorAndSkipSentry({
          type: 'Error',
          value: 'AbortError: AbortError',
        }),
      ).toBe(true);
    });

    test('should filter cancel timeout', () => {
      expect(
        isFilterErrorAndSkipSentry({
          type: 'Error',
          value: 'cancel timeout',
        }),
      ).toBe(true);
    });

    test('should NOT filter unknown error values', () => {
      expect(
        isFilterErrorAndSkipSentry({
          type: 'Error',
          value: 'Unknown error message',
        }),
      ).toBe(false);
    });

    test('should filter other known error values', () => {
      // Test via function behavior, not constant
      expect(
        isFilterErrorAndSkipSentry({
          type: 'Error',
          value: 'AbortError: AbortError',
        }),
      ).toBe(true);
      expect(
        isFilterErrorAndSkipSentry({
          type: 'Error',
          value: 'cancel timeout',
        }),
      ).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('should return false for undefined error', () => {
      expect(isFilterErrorAndSkipSentry(undefined)).toBe(false);
    });

    test('should return false for empty error object', () => {
      expect(isFilterErrorAndSkipSentry({})).toBe(false);
    });

    test('should return false for error with only value (non-matching)', () => {
      expect(isFilterErrorAndSkipSentry({ value: 'Some random error' })).toBe(
        false,
      );
    });

    test('should return false for error with only type (non-matching)', () => {
      expect(isFilterErrorAndSkipSentry({ type: 'RandomType' })).toBe(false);
    });
  });

  describe('desktop-specific filters', () => {
    const originalIsDesktop = platformEnv.isDesktop;

    beforeEach(() => {
      // Mock platformEnv.isDesktop to true for desktop-specific tests
      (platformEnv as { isDesktop: boolean }).isDesktop = true;
    });

    afterEach(() => {
      // Restore original value
      (platformEnv as { isDesktop: boolean }).isDesktop =
        originalIsDesktop ?? false;
    });

    test('should filter CustomElementRegistry errors on desktop', () => {
      expect(
        isFilterErrorAndSkipSentry({
          type: 'Error',
          value: `Failed to execute 'define' on 'CustomElementRegistry': some error`,
        }),
      ).toBe(true);
    });

    test('should filter ERR_CONNECTION_CLOSED + GUEST_VIEW_MANAGER_CALL on desktop', () => {
      expect(
        isFilterErrorAndSkipSentry({
          type: 'Error',
          value:
            'Error invoking remote method GUEST_VIEW_MANAGER_CALL: Error: ERR_CONNECTION_CLOSED (-100)',
        }),
      ).toBe(true);
    });

    test('should NOT filter ERR_CONNECTION_CLOSED without GUEST_VIEW_MANAGER_CALL', () => {
      expect(
        isFilterErrorAndSkipSentry({
          type: 'Error',
          value: 'ERR_CONNECTION_CLOSED (-100)',
        }),
      ).toBe(false);
    });

    test('should NOT filter GUEST_VIEW_MANAGER_CALL without ERR_CONNECTION_CLOSED', () => {
      expect(
        isFilterErrorAndSkipSentry({
          type: 'Error',
          value: 'Error invoking remote method GUEST_VIEW_MANAGER_CALL',
        }),
      ).toBe(false);
    });
  });
});

describe('buildBasicOptions', () => {
  test('should return config object with correct properties', () => {
    const onError = jest.fn();
    const options = buildBasicOptions({ onError });

    expect(options.enabled).toBe(true);
    expect(options.maxBreadcrumbs).toBe(100);
    expect(options.tracesSampleRate).toBe(0.1);
    expect(options.profilesSampleRate).toBe(0.1);
    expect(typeof options.beforeSend).toBe('function');
  });

  describe('beforeSend', () => {
    const callBeforeSend = (
      options: ReturnType<typeof buildBasicOptions>,
      event: any,
    ) => {
      if (options.beforeSend) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return options.beforeSend(event, {});
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return event;
    };

    test('should sanitize error message and call onError callback', () => {
      const onError = jest.fn();
      const options = buildBasicOptions({ onError });
      const event: any = {
        exception: {
          values: [
            {
              value: `Error with key ${TEST_ETH_PRIVATE_KEY}`,
              stacktrace: { frames: [] },
            },
          ],
        },
      };

      void callBeforeSend(options, event);

      expect(event.exception.values[0].value).toBe('Error with key ****');
      expect(onError).toHaveBeenCalledWith('Error with key ****', {
        frames: [],
      });
    });

    test('should sanitize stacktrace variables', () => {
      const onError = jest.fn();
      const options = buildBasicOptions({ onError });
      const event: any = {
        exception: {
          values: [
            {
              value: 'Test error',
              stacktrace: {
                frames: [
                  {
                    vars: {
                      secret: TEST_ETH_PRIVATE_KEY,
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      void callBeforeSend(options, event);

      expect(event.exception.values[0].stacktrace.frames[0].vars.secret).toBe(
        '****',
      );
    });

    test('should filter breadcrumbs with sentry.event category and error level', () => {
      const onError = jest.fn();
      const options = buildBasicOptions({ onError });
      const event: any = {
        exception: { values: [] },
        breadcrumbs: [
          { category: 'sentry.event', level: 'info' },
          { category: 'navigation', level: 'info' },
          { category: 'http', level: 'error' },
          { category: 'console', level: 'info' },
        ],
      };

      const result = callBeforeSend(options, event);

      expect(result).not.toBeNull();
      expect(event.breadcrumbs).toEqual([
        { category: 'navigation', level: 'info' },
        { category: 'console', level: 'info' },
      ]);
    });

    test('should return null for filtered error types', () => {
      const onError = jest.fn();
      const options = buildBasicOptions({ onError });
      const event: any = {
        exception: {
          values: [
            {
              type: 'AxiosError',
              value: 'Network error',
            },
          ],
        },
      };

      const result = callBeforeSend(options, event);

      expect(result).toBeNull();
    });

    test('should handle event without exception values', () => {
      const onError = jest.fn();
      const options = buildBasicOptions({ onError });
      const event: any = {
        message: 'Simple message',
      };

      const result = callBeforeSend(options, event);

      expect(result).toBe(event);
      expect(onError).not.toHaveBeenCalled();
    });

    test('should handle exception value without stacktrace', () => {
      const onError = jest.fn();
      const options = buildBasicOptions({ onError });
      const event: any = {
        exception: {
          values: [
            {
              value: `Secret: ${TEST_MNEMONIC_3}`,
            },
          ],
        },
      };

      void callBeforeSend(options, event);

      expect(event.exception.values[0].value).toBe('Secret: **** **** ****');
      expect(onError).toHaveBeenCalledWith('Secret: **** **** ****', undefined);
    });
  });
});
