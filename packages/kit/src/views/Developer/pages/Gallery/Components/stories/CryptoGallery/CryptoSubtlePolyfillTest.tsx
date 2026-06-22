import { useState } from 'react';

import crypto from 'crypto';

import { Button, SizableText, Toast } from '@onekeyhq/components';
import type { IRunAppCryptoTestTaskResult } from '@onekeyhq/shared/src/appCrypto/utils';
import {
  AppCryptoTestEmoji,
  runAppCryptoTestTask,
} from '@onekeyhq/shared/src/appCrypto/utils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { PartContainer, runCryptoGalleryTestExclusive } from './shared';

/**
 * Test crypto.subtle polyfill
 * This polyfill is required for Supabase Auth PKCE flow on React Native
 * @see packages/shared/src/appCrypto/cryptoSubtlePolyfill.js
 */
export function CryptoSubtlePolyfillTest() {
  const [result, setResult] = useState('');

  const testCryptoSubtle = async () => {
    try {
      const tasks: IRunAppCryptoTestTaskResult[] = [];

      // Test 1: Check if crypto.subtle exists
      tasks.push(
        await runAppCryptoTestTask({
          expect: 'true',
          name: 'crypto.subtle exists',
          fn: async () => {
            return String(
              typeof crypto !== 'undefined' &&
                typeof crypto.subtle !== 'undefined' &&
                typeof crypto.subtle.digest === 'function',
            );
          },
        }),
      );

      // Test 2: SHA-256 digest test
      // Hash of "hello" in SHA-256 should be:
      // 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      const testData = new TextEncoder().encode('hello');
      const expectedSha256 =
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';

      tasks.push(
        await runAppCryptoTestTask({
          expect: expectedSha256,
          name: 'crypto.subtle.digest(SHA-256)',
          fn: async () => {
            const hashBuffer = await crypto.subtle.digest('SHA-256', testData);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            return hashHex;
          },
        }),
      );

      // Test 3: SHA-512 digest test
      // Hash of "hello" in SHA-512
      const expectedSha512 =
        '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043';

      tasks.push(
        await runAppCryptoTestTask({
          expect: expectedSha512,
          name: 'crypto.subtle.digest(SHA-512)',
          fn: async () => {
            const hashBuffer = await crypto.subtle.digest('SHA-512', testData);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            return hashHex;
          },
        }),
      );

      // Test 4: SHA-1 digest test
      // Hash of "hello" in SHA-1
      const expectedSha1 = 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d';

      tasks.push(
        await runAppCryptoTestTask({
          expect: expectedSha1,
          name: 'crypto.subtle.digest(SHA-1)',
          fn: async () => {
            const hashBuffer = await crypto.subtle.digest('SHA-1', testData);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            return hashHex;
          },
        }),
      );

      // Test 5: Supabase PKCE simulation test
      // Simulate the actual PKCE flow that Supabase uses
      const codeVerifier = 'test-code-verifier-for-pkce-flow';
      const verifierData = new TextEncoder().encode(codeVerifier);

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            'f0c2f8b2aad90ad913c0561953b38bf3d435f59b5e4ef24eebc6605b0b444907',
          name: 'crypto.subtle.digest(PKCE simulation)',
          fn: async () => {
            const hashBuffer = await crypto.subtle.digest(
              'SHA-256',
              verifierData,
            );
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            return hashHex;
          },
        }),
      );

      setResult(
        stringUtils.stableStringify(
          tasks,
          stringUtils.STRINGIFY_REPLACER.bufferToHex,
          2,
        ),
      );

      const allPassed = tasks.every(
        (t) => t.isCorrect === AppCryptoTestEmoji.isCorrect,
      );
      if (allPassed) {
        Toast.success({
          title: 'crypto.subtle polyfill test passed',
        });
      } else {
        Toast.error({
          title: 'crypto.subtle polyfill test failed',
        });
      }
    } catch (error) {
      setResult(`Error: ${(error as Error).message}`);
      Toast.error({
        title: `crypto.subtle test failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="crypto.subtle Polyfill Test">
      <Button
        variant="primary"
        onPress={() => runCryptoGalleryTestExclusive(testCryptoSubtle)}
      >
        Test crypto.subtle Polyfill
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}
