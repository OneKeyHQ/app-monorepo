/* eslint-disable prefer-const */
import { useState } from 'react';

import crypto from 'crypto';

import {
  Button,
  DebugRenderTracker,
  Icon,
  SizableText,
  Stack,
  Toast,
  View,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import type { IBip39RevealableSeed } from '@onekeyhq/core/src/secret';
import type { ICurveName } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDemoPriceInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/demo';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import type { IRunAppCryptoTestTaskResult } from '@onekeyhq/shared/src/appCrypto/utils';
import {
  AppCryptoTestEmoji,
  runAppCryptoTestTask,
} from '@onekeyhq/shared/src/appCrypto/utils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { Layout } from './utils/Layout';

// Core secret functions are loaded dynamically to avoid kit->core value import
async function loadCoreSecret() {
  return import('@onekeyhq/core/src/secret');
}

function PartContainer({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <YStack>
      <YStack gap="$5">{children}</YStack>
    </YStack>
  );
}

// Custom Accordion Components
function CustomAccordion({ children }: { children: React.ReactNode }) {
  return (
    <YStack gap="$2" width="100%">
      {children}
    </YStack>
  );
}

function CustomAccordionItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <YStack
      // borderColor="$border"
      // borderWidth={StyleSheet.hairlineWidth}
      // borderRadius="$2"
      overflow="hidden"
    >
      <Stack
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        py="$4"
        px="$2"
        borderRadius="$2"
        pressStyle={{ opacity: 0.7 }}
        onPress={() => setIsOpen(!isOpen)}
        bg="$backgroundFocus"
      >
        <SizableText>{title}</SizableText>
        <View
          animation="quick"
          animateOnly={ANIMATE_ONLY_TRANSFORM}
          rotate={isOpen ? '0deg' : '-90deg'}
          transformOrigin="center"
        >
          <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$6" />
        </View>
      </Stack>

      <YStack
        animation="quick"
        animateOnly={ANIMATE_ONLY_OPACITY}
        opacity={isOpen ? 1 : 0}
        overflow="hidden"
        style={{
          maxHeight: isOpen ? 100_000 : 0,
          transition: 'max-height 0.3s ease-in-out',
        }}
      >
        <YStack paddingTop="$2">{children}</YStack>
      </YStack>
    </YStack>
  );
}

// Test Components
function PBKDF2Test() {
  const [result, setResult] = useState('');

  const testPBKDF2 = async () => {
    try {
      const r = await appCrypto.pbkdf2.$testSampleForPbkdf2();
      setResult(JSON.stringify(r, null, 2));
      Toast.success({
        title: `PBKDF2 completed `,
      });
    } catch (error) {
      Toast.error({
        title: `PBKDF2 failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="PBKDF2 Test">
      <Button variant="primary" onPress={testPBKDF2}>
        Test PBKDF2
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function HashTest() {
  const [result, setResult] = useState('');

  const testHash = async () => {
    try {
      const r = await appCrypto.hash.$testSampleForHash();
      setResult(JSON.stringify(r, null, 2));
      Toast.success({
        title: `Hash completed `,
      });
    } catch (error) {
      Toast.error({
        title: `Hash failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="Hash Test">
      <Button variant="primary" onPress={testHash}>
        Test Hash
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function KeyGenTest() {
  const [result, setResult] = useState('');

  const testKeyGen = async () => {
    try {
      const r = await appCrypto.keyGen.$testSampleForKeyGen();
      setResult(JSON.stringify(r, null, 2));
      Toast.success({
        title: `KeyGen completed`,
      });
    } catch (error) {
      Toast.error({
        title: `KeyGen failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="KeyGen Test">
      <Button variant="primary" onPress={testKeyGen}>
        Test KeyGen
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function AESCbcTest() {
  const [result, setResult] = useState('');

  const testAESCbc = async () => {
    try {
      const r = await appCrypto.aesCbc.$testSampleForAesCbc();
      setResult(JSON.stringify(r, null, 2));
      Toast.success({
        title: `AES-CBC completed`,
      });
    } catch (error) {
      Toast.error({
        title: `AES-CBC failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="AES-CBC Test">
      <Button variant="primary" onPress={testAESCbc}>
        Test AES-CBC
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function AESGcmV2Test() {
  const [result, setResult] = useState('');
  const iterationOptions = [5000, 600_000, 1_000_000, 3_000_000];

  const testAESGcmV2 = async (iterationsToRun = iterationOptions) => {
    try {
      const { decryptAsync, decryptAsyncWithMetadata, encryptAsync } =
        await loadCoreSecret();
      const tasks: IRunAppCryptoTestTaskResult[] = [];
      const data = Buffer.from('onekey-aes-gcm-v2-gallery-test', 'utf8');
      const key = Buffer.from(
        '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
        'hex',
      );
      const nonce = Buffer.from('202122232425262728292a2b', 'hex');
      const aad = Buffer.from('onekey-gallery-aad-v1', 'utf8');
      const password = 'onekey-gallery-password';
      const v2MagicText = '1K_ENC_V2';
      const v2MagicHex = Buffer.from(v2MagicText, 'utf8').toString('hex');
      const legacyGcmMagicText = appCrypto.consts.AES_GCM_ENCRYPTION_MAGIC;
      const legacyGcmMagicHex = Buffer.from(
        legacyGcmMagicText,
        'utf8',
      ).toString('hex');
      const defaultPbkdf2Backend =
        appCrypto.pbkdf2.getPbkdf2BackendForCurrentPlatform();
      const defaultAesGcmBackend =
        appCrypto.aesGcm.getAesGcmBackendForCurrentPlatform();
      const expectedDefaultIterations =
        appCrypto.consts.PBKDF2_CURRENT_NUM_OF_ITERATIONS;
      const actualEncryptRuns: Array<{
        aesGcmInvocation: ReturnType<
          typeof appCrypto.aesGcm.getLastAesGcmInvocation
        >;
        pbkdf2Invocation: ReturnType<
          typeof appCrypto.pbkdf2.getLastPbkdf2Invocation
        >;
        payloadHeaderHex?: string;
        payloadHeaderKind:
          | 'legacy-cbc-no-magic-header'
          | 'legacy-gcm'
          | 'unknown'
          | 'v2';
        payloadHeaderText?: string;
        payloadIterations: number;
        payloadVersion: string;
        requestedIterations: number | 'default';
        time: number;
      }> = [];

      const getKnownPayloadHeader = (encryptedHex: string) => {
        if (encryptedHex.startsWith(v2MagicHex)) {
          return {
            payloadHeaderHex: v2MagicHex,
            payloadHeaderKind: 'v2' as const,
            payloadHeaderText: v2MagicText,
          };
        }
        if (encryptedHex.startsWith(legacyGcmMagicHex)) {
          return {
            payloadHeaderHex: legacyGcmMagicHex,
            payloadHeaderKind: 'legacy-gcm' as const,
            payloadHeaderText: legacyGcmMagicText,
          };
        }
        return {
          payloadHeaderKind: 'legacy-cbc-no-magic-header' as const,
        };
      };

      const encryptWithActualProbe = async (iterations?: number) => {
        const debugCryptoProbeId = `crypto-gallery-${Date.now()}-${
          actualEncryptRuns.length
        }`;
        appCrypto.pbkdf2.clearLastPbkdf2Invocation();
        appCrypto.aesGcm.clearLastAesGcmInvocation();
        appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(debugCryptoProbeId);
        appCrypto.aesGcm.clearAesGcmInvocationByProbeId(debugCryptoProbeId);
        const start = Date.now();
        const encrypted = await encryptAsync({
          password,
          data,
          allowRawPassword: true,
          ...(iterations ? { iterations } : undefined),
          debugCryptoProbeId,
        });
        const time = Date.now() - start;
        const pbkdf2Invocation =
          appCrypto.pbkdf2.getPbkdf2InvocationByProbeId(debugCryptoProbeId);
        const aesGcmInvocation =
          appCrypto.aesGcm.getAesGcmInvocationByProbeId(debugCryptoProbeId);
        const encryptedHex = bufferUtils.bytesToHex(encrypted);
        const payloadHeader = getKnownPayloadHeader(encryptedHex);
        const metadata = await decryptAsyncWithMetadata({
          password,
          data: encrypted,
          allowRawPassword: true,
        });
        const requestedIterations: number | 'default' = iterations ?? 'default';
        const actualRun = {
          aesGcmInvocation,
          pbkdf2Invocation,
          ...payloadHeader,
          payloadIterations: metadata.iterations,
          payloadVersion: metadata.version,
          requestedIterations,
          time,
        };
        actualEncryptRuns.push(actualRun);
        appCrypto.pbkdf2.clearPbkdf2InvocationByProbeId(debugCryptoProbeId);
        appCrypto.aesGcm.clearAesGcmInvocationByProbeId(debugCryptoProbeId);
        return {
          ...actualRun,
          encrypted,
          encryptedHex,
          metadata,
        };
      };

      const nobleEncrypted = appCrypto.aesGcm.aesGcmEncryptByNoble({
        nonce,
        key,
        data,
        aad,
      });

      tasks.push(
        await runAppCryptoTestTask({
          expect: bufferUtils.bytesToHex(nobleEncrypted),
          name: 'AES-GCM default wrapper matches noble',
          fn: () =>
            appCrypto.aesGcm.aesGcmEncrypt({
              nonce,
              key,
              data,
              aad,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: bufferUtils.bytesToHex(nobleEncrypted),
          name: 'AES-GCM native wrapper matches noble',
          fn: () =>
            appCrypto.aesGcm.aesGcmEncryptByRNAes({
              nonce,
              key,
              data,
              aad,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: bufferUtils.bytesToHex(data),
          name: 'AES-GCM native decrypt',
          fn: () =>
            appCrypto.aesGcm.aesGcmDecryptByRNAes({
              nonce,
              key,
              data: nobleEncrypted,
              aad,
            }),
        }),
      );

      const hashedPassword = await appCrypto.hash.sha256(
        Buffer.from(password, 'utf8'),
      );
      const salt = Buffer.from(
        '303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f',
        'hex',
      );

      for (const iterations of iterationsToRun) {
        const defaultKey = await appCrypto.pbkdf2.pbkdf2({
          password: hashedPassword,
          salt,
          iterations,
        });

        tasks.push(
          await runAppCryptoTestTask({
            expect: bufferUtils.bytesToHex(defaultKey),
            name: `PBKDF2 default(${defaultPbkdf2Backend}) ${iterations}`,
            fn: () =>
              appCrypto.pbkdf2.pbkdf2({
                password: hashedPassword,
                salt,
                iterations,
              }),
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: bufferUtils.bytesToHex(defaultKey),
            name: `PBKDF2 native ${iterations}`,
            fn: () =>
              appCrypto.pbkdf2.pbkdf2ByRNAes({
                password: hashedPassword,
                salt,
                iterations,
              }),
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: bufferUtils.bytesToHex(defaultKey),
            name: `PBKDF2 noble ${iterations}`,
            fn: () =>
              appCrypto.pbkdf2.pbkdf2ByNoble({
                password: hashedPassword,
                salt,
                iterations,
              }),
          }),
        );

        const encryptedByIterations = await encryptWithActualProbe(iterations);

        tasks.push(
          await runAppCryptoTestTask({
            expect: 'true',
            name: `encryptAsync v2 prefix ${iterations}`,
            fn: () =>
              String(encryptedByIterations.encryptedHex.startsWith(v2MagicHex)),
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: String(iterations),
            name: `actual payload iterations ${iterations}`,
            fn: () => String(encryptedByIterations.metadata.iterations),
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: String(iterations),
            name: `actual PBKDF2 probe iterations ${iterations}`,
            fn: () =>
              String(
                encryptedByIterations.pbkdf2Invocation?.iterations ?? 'missing',
              ),
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: defaultPbkdf2Backend,
            name: `actual PBKDF2 probe backend ${iterations}`,
            fn: () =>
              encryptedByIterations.pbkdf2Invocation?.backend ?? 'missing',
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: defaultAesGcmBackend,
            name: `actual AES-GCM probe backend ${iterations}`,
            fn: () =>
              encryptedByIterations.aesGcmInvocation?.backend ?? 'missing',
          }),
        );

        tasks.push(
          await runAppCryptoTestTask({
            expect: 'encrypt',
            name: `actual AES-GCM probe operation ${iterations}`,
            fn: () =>
              encryptedByIterations.aesGcmInvocation?.operation ?? 'missing',
          }),
        );
      }

      const encryptedV2 = await encryptWithActualProbe();

      tasks.push(
        await runAppCryptoTestTask({
          expect: 'true',
          name: 'encryptAsync default writes 1K_ENC_V2',
          fn: () => String(encryptedV2.encryptedHex.startsWith(v2MagicHex)),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: String(expectedDefaultIterations),
          name: 'encryptAsync default iterations',
          fn: () => String(encryptedV2.metadata.iterations),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: String(expectedDefaultIterations),
          name: 'actual default PBKDF2 probe iterations',
          fn: () =>
            String(encryptedV2.pbkdf2Invocation?.iterations ?? 'missing'),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: defaultPbkdf2Backend,
          name: 'actual default PBKDF2 probe backend',
          fn: () => encryptedV2.pbkdf2Invocation?.backend ?? 'missing',
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: defaultAesGcmBackend,
          name: 'actual default AES-GCM probe backend',
          fn: () => encryptedV2.aesGcmInvocation?.backend ?? 'missing',
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: 'encrypt',
          name: 'actual default AES-GCM probe operation',
          fn: () => encryptedV2.aesGcmInvocation?.operation ?? 'missing',
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: bufferUtils.bytesToHex(data),
          name: 'decryptAsync reads v2 payload',
          fn: () =>
            decryptAsync({
              password,
              data: encryptedV2.encrypted,
              allowRawPassword: true,
            }),
        }),
      );

      setResult(
        stringUtils.stableStringify(
          {
            platform: {
              isNative: platformEnv.isNative,
              isNativeIOS: platformEnv.isNativeIOS,
              isNativeAndroid: platformEnv.isNativeAndroid,
            },
            actualEncryptRuns,
            defaultPath: {
              pbkdf2: defaultPbkdf2Backend,
              aesGcm: defaultAesGcmBackend,
              iterations: expectedDefaultIterations,
            },
            v2MagicHex,
            v2MagicText,
            legacyGcmMagicHex,
            legacyGcmMagicText,
            encryptedV2Header: getKnownPayloadHeader(encryptedV2.encryptedHex),
            tasks,
          },
          stringUtils.STRINGIFY_REPLACER.bufferToHex,
          2,
        ),
      );

      const allPassed = tasks.every(
        (t) => t.isCorrect === AppCryptoTestEmoji.isCorrect,
      );
      if (allPassed) {
        Toast.success({
          title: 'AES-GCM v2 test passed',
        });
      } else {
        Toast.error({
          title: 'AES-GCM v2 test failed',
        });
      }
    } catch (error) {
      setResult(`Error: ${(error as Error).message}`);
      Toast.error({
        title: `AES-GCM v2 failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="AES-GCM v2 Test">
      <Button variant="primary" onPress={() => testAESGcmV2()}>
        Test AES-GCM v2 Native All
      </Button>
      <Stack flexDirection="row" flexWrap="wrap" gap="$2">
        {iterationOptions.map((iterations) => (
          <Button
            key={iterations}
            size="small"
            onPress={() => testAESGcmV2([iterations])}
          >
            {String(iterations)} iterations
          </Button>
        ))}
      </Stack>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

/**
 * Test crypto.subtle polyfill
 * This polyfill is required for Supabase Auth PKCE flow on React Native
 * @see packages/shared/src/appCrypto/cryptoSubtlePolyfill.js
 */
function CryptoSubtlePolyfillTest() {
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
      <Button variant="primary" onPress={testCryptoSubtle}>
        Test crypto.subtle Polyfill
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function SecretFunctionsTest() {
  const [result, setResult] = useState('');

  const testSecretFunctions = async () => {
    try {
      const {
        batchGetPublicKeys,
        decodeSensitiveTextAsync,
        decryptAsync,
        encodeSensitiveTextAsync,
        encryptAsync,
        encryptRevealableSeed,
        generateRootFingerprintHexAsync,
        mnemonicFromEntropyAsync,
        mnemonicToRevealableSeed,
        mnemonicToSeedAsync,
      } = await loadCoreSecret();
      const tasks: IRunAppCryptoTestTaskResult[] = [];

      const testPasswordRaw = 'password123';
      const encodeSensitiveTextKey =
        'ENCODE_KEY::755174C1-6480-401A-8C3D-84ADB2E0C376::cf6e2e1c-e53b-431e-a6e4-3f27c9a7ac0b';

      let customSalt = bufferUtils.toBuffer(
        '8ff67563c060ca12aac18757221cea72482d139ea65d5f5d4f55a05c69ae87eb',
      );
      let customIv = bufferUtils.toBuffer('ad76f31087e49bbc59ac0f08d679e4c0');
      // const customSalt = crypto.randomBytes(PBKDF2_SALT_LENGTH);
      // const customIv = crypto.randomBytes(AES256_IV_LENGTH);

      let testPasswordEncoded = '';
      testPasswordEncoded = await encodeSensitiveTextAsync({
        text: testPasswordRaw,
        key: encodeSensitiveTextKey,
      });

      tasks.push(
        await runAppCryptoTestTask({
          expect: '⚠️ Wrong password',
          name: 'decodeSensitiveTextAsync(Wrong password) 😃',
          fn: () =>
            decodeSensitiveTextAsync({
              encodedText:
                'SENSITIVE_ENCODE::AE7EADC1-CDA0-45FA-A340-E93BEDDEA21E::91bd9aee6525991dbde19d4d51f7265904d5db1592c6b0dfcdcc6ecfddd447883b2797a16926ddbea96c80acaaf99c0bee98282c0f966938095e1369da781ca7',
              key: encodeSensitiveTextKey,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: testPasswordRaw,
          name: 'decodeSensitiveTextAsync 😃',
          fn: () =>
            decodeSensitiveTextAsync({
              encodedText: testPasswordEncoded,
              key: encodeSensitiveTextKey,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: testPasswordRaw,
          name: 'decodeSensitiveTextAsync(2) 😃',
          fn: () =>
            decodeSensitiveTextAsync({
              encodedText:
                'SENSITIVE_ENCODE::AE7EADC1-CDA0-45FA-A340-E93BEDDEA21E::4148c9fc99fa20bb83d3c925b6b94f9cd8e1ba45e21ddfc40b9d3627b17adcc9dbaf4805799fd7da5b581ea70bd31b7876d2bbf6a53d6956c2afb17adbbc5f2f',
              key: encodeSensitiveTextKey,
            }),
        }),
      );

      // console.log('testPasswordEncoded', {
      //   encryptAsyncTestResult: bufferUtils.bytesToHex(encryptAsyncTestResult),
      //   // customIv: bufferUtils.bytesToHex(customIv),
      //   // customIvLength: customIv.length,
      //   // customSalt: bufferUtils.bytesToHex(customSalt),
      //   // customSaltLength: customSalt.length,
      //   testPasswordRaw,
      //   testPasswordEncoded,
      //   testPasswordDecoded,
      //   testPasswordDecoded2,
      //   // testPasswordDecoded3: testPasswordDecoded3 || '---',
      // });

      let testPassword = '';
      testPassword =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: testPasswordRaw,
        });

      let rawTestPassword = '';
      tasks.push(
        await runAppCryptoTestTask({
          expect: testPasswordRaw,
          name: 'decodeSensitiveText 😃',
          fn: async () => {
            rawTestPassword =
              await backgroundApiProxy.servicePassword.decodeSensitiveText({
                encodedText: testPassword,
              });
            return rawTestPassword;
          },
        }),
      );

      const testSeed: IBip39RevealableSeed = {
        entropyWithLangPrefixed: '00112233445566778899aabbccddeeff',
        seed: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
      };
      const curveName: ICurveName = 'secp256k1';
      const prefix = 'm';
      const relPaths = ['0/0', '0/1', "44'/0'/0'/0/0"];

      let encryptedSeed = '';
      encryptedSeed = await encryptRevealableSeed({
        rs: testSeed,
        password: testPassword,
      });

      const batchGetPublicKeysExpect =
        '039963f5256af9f48d9d4a340e352f8cec3719b48d9f8514a5495785bb7d7bdac3';
      tasks.push(
        await runAppCryptoTestTask({
          expect: batchGetPublicKeysExpect,
          name: 'batchGetPublicKeys(useWebembedApi) 😃',
          fn: async () => {
            const r1 = await batchGetPublicKeys({
              curveName,
              hdCredential: encryptedSeed,
              password: testPassword,
              prefix,
              relPaths,
            });
            return r1?.[2]?.extendedKey?.key;
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: batchGetPublicKeysExpect,
          name: 'batchGetPublicKeys(useWebembedApi, byAsyncSubCalls) 😃',
          fn: async () => {
            const r1 = await batchGetPublicKeys({
              curveName,
              hdCredential: encryptedSeed,
              password: testPassword,
              prefix,
              relPaths,
              byAsyncSubCalls: true,
            });
            return r1?.[2]?.extendedKey?.key;
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: batchGetPublicKeysExpect,
          name: 'batchGetPublicKeys(useRnJsCrypto)',
          fn: async () => {
            const r1 = await batchGetPublicKeys({
              curveName,
              hdCredential: encryptedSeed,
              password: testPassword,
              prefix,
              relPaths,
              useWebembedApi: false,
            });
            return r1?.[2]?.extendedKey?.key;
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: batchGetPublicKeysExpect,
          name: 'batchGetPublicKeys(useRnJsCrypto, byAsyncSubCalls)',
          fn: async () => {
            const r1 = await batchGetPublicKeys({
              curveName,
              hdCredential: encryptedSeed,
              password: testPassword,
              prefix,
              relPaths,
              byAsyncSubCalls: true,
              useWebembedApi: false,
            });
            return r1?.[2]?.extendedKey?.key;
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            '8ff67563c060ca12aac18757221cea72482d139ea65d5f5d4f55a05c69ae87ebad76f31087e49bbc59ac0f08d679e4c0869f9babcc7ec4c2557a42abebb072b4',
          name: 'encryptAsync 😃',
          fn: async () =>
            encryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: testPasswordRaw,
                }),
              data: bufferUtils.utf8ToBytes(testPasswordRaw),
              customIv,
              customSalt,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            '8ff67563c060ca12aac18757221cea72482d139ea65d5f5d4f55a05c69ae87ebad76f31087e49bbc59ac0f08d679e4c0869f9babcc7ec4c2557a42abebb072b4',
          name: 'encryptAsync(useWebembedApi)',
          fn: async () => {
            return encryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: testPasswordRaw,
                }),
              data: bufferUtils.utf8ToBytes(testPasswordRaw),
              useWebembedApi: true,
              customIv,
              customSalt,
            });
          },
        }),
      );

      const r6 = await encryptAsync({
        password: await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: testPasswordRaw,
        }),
        data: bufferUtils.utf8ToBytes(testPasswordRaw),
        useWebembedApi: true,
      });

      tasks.push(
        await runAppCryptoTestTask({
          expect: '70617373776f7264313233',
          name: 'decryptAsync 😃',
          fn: async () =>
            decryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: testPasswordRaw,
                }),
              data: r6,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: '⚠️ Wrong password',
          name: 'decryptAsync (wrong password) 😃',
          fn: async () =>
            decryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: `1111`,
                }),
              data: r6,
            }),
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: '70617373776f7264313233',
          name: 'decryptAsync(useWebembedApi)',
          fn: async () =>
            decryptAsync({
              password:
                await backgroundApiProxy.servicePassword.encodeSensitiveText({
                  text: testPasswordRaw,
                }),
              data: r6,
              useWebembedApi: true,
            }),
        }),
      );

      const testMnemonic =
        'test test test test test test test test test test test junk';
      const rs = mnemonicToRevealableSeed(testMnemonic, 'optional passphrase');
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });

      tasks.push(
        await runAppCryptoTestTask({
          expect: 'test test test test test test test test test test test junk',
          name: 'mnemonicFromEntropyAsync(useRnJsCrypto)😃',
          fn: async () => {
            return mnemonicFromEntropyAsync({
              hdCredential,
              password: testPassword,
            });
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: 'test test test test test test test test test test test junk',
          name: 'mnemonicFromEntropyAsync(useWebembedApi)',
          fn: async () => {
            return mnemonicFromEntropyAsync({
              hdCredential,
              password: testPassword,
              useWebembedApi: true,
            });
          },
        }),
      );

      const testPassphrase = 'optional passphrase';

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            'bc0d03ab4f8871dd4a7a68423894bb88fb54973899e4721c9dffd09a5b589171b5712b27da764f7be0653ba361f445b4f9251b490525833b644b7a13eebc7e2c',
          name: 'mnemonicToSeedAsync(useWebembedApi)😃',
          fn: async () => {
            return mnemonicToSeedAsync({
              mnemonic: testMnemonic,
              passphrase: testPassphrase,
            });
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect:
            'bc0d03ab4f8871dd4a7a68423894bb88fb54973899e4721c9dffd09a5b589171b5712b27da764f7be0653ba361f445b4f9251b490525833b644b7a13eebc7e2c',
          name: 'mnemonicToSeedAsync(useRnJsCrypto)',
          fn: async () => {
            return mnemonicToSeedAsync({
              mnemonic: testMnemonic,
              passphrase: testPassphrase,
              useWebembedApi: false,
            });
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: '045a91ef',
          name: 'generateRootFingerprintHexAsync(useRnJsCrypto)😃',
          fn: async () => {
            return generateRootFingerprintHexAsync({
              curveName: 'secp256k1',
              hdCredential,
              password: testPassword,
            });
          },
        }),
      );

      tasks.push(
        await runAppCryptoTestTask({
          expect: '045a91ef',
          name: 'generateRootFingerprintHexAsync(useWebembedApi)',
          fn: async () => {
            return generateRootFingerprintHexAsync({
              curveName: 'secp256k1',
              hdCredential,
              password: testPassword,
              useWebembedApi: true,
            });
          },
        }),
      );

      setResult(
        stringUtils.stableStringify(
          tasks,
          // null,
          stringUtils.STRINGIFY_REPLACER.bufferToHex,
          2,
        ),
      );
    } catch (error) {
      Toast.error({
        title: `SecretFunctions failed: ${(error as Error).message}`,
      });
    }
  };

  const testSecretFunctions2 = async () => {
    try {
      const {
        encryptRevealableSeed,
        generateRootFingerprintHexAsync,
        mnemonicToRevealableSeed,
      } = await loadCoreSecret();
      const tasks: IRunAppCryptoTestTaskResult[] = [];
      const testPasswordRaw = 'password123';

      let testPassword = '';
      testPassword =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: testPasswordRaw,
        });

      const testMnemonic =
        'test test test test test test test test test test test junk';
      const rs = mnemonicToRevealableSeed(testMnemonic, 'optional passphrase');
      const hdCredential = await encryptRevealableSeed({
        rs,
        password: testPassword,
      });

      tasks.push(
        await runAppCryptoTestTask({
          expect: '045a91ef',
          name: 'generateRootFingerprintHexAsync(useRnJsCrypto)😃',
          fn: async () => {
            return generateRootFingerprintHexAsync({
              curveName: 'secp256k1',
              hdCredential,
              password: testPassword,
            });
          },
        }),
      );

      setResult(
        stringUtils.stableStringify(
          tasks,
          // null,
          stringUtils.STRINGIFY_REPLACER.bufferToHex,
          2,
        ),
      );
    } catch (error) {
      Toast.error({
        title: `SecretFunctions2 failed: ${(error as Error).message}`,
      });
    }
  };

  return (
    <PartContainer title="SecretFunctions Test">
      <Button variant="primary" onPress={testSecretFunctions}>
        Test SecretFunctions
      </Button>
      <Button variant="primary" onPress={testSecretFunctions2}>
        Test SecretFunctions2
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

function JotaiDemoPriceInfo() {
  const [demoPriceInfo, setDemoPriceInfo] = useDemoPriceInfoAtom();

  return (
    <DebugRenderTracker>
      <Stack>
        <SizableText size="$bodyMd">
          {JSON.stringify(demoPriceInfo, null, 2)}
        </SizableText>
        <Button
          variant="primary"
          onPress={() =>
            setDemoPriceInfo((prev) => ({ ...prev, price: 10, info: 'info' }))
          }
        >
          setDemoPriceInfo(new object)
        </Button>
        <Button
          variant="primary"
          onPress={() => setDemoPriceInfo((prev) => prev)}
        >
          setDemoPriceInfo(prev object)
        </Button>
      </Stack>
    </DebugRenderTracker>
  );
}

const CryptoGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Crypto"
    elements={[
      {
        title: 'Default',
        element: (
          <Stack>
            <SizableText mb="$4" size="$bodyMd">
              {JSON.stringify(AppCryptoTestEmoji, null, 2)}
            </SizableText>
            <CustomAccordion>
              <CustomAccordionItem title="PBKDF2 Test">
                <PBKDF2Test />
              </CustomAccordionItem>
              <CustomAccordionItem title="KeyGen Test">
                <KeyGenTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="Hash Test">
                <HashTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="AES-CBC Test">
                <AESCbcTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="AES-GCM v2 Test">
                <AESGcmV2Test />
              </CustomAccordionItem>
              <CustomAccordionItem title="crypto.subtle Polyfill Test">
                <CryptoSubtlePolyfillTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="SecretFunctions Test">
                <SecretFunctionsTest />
              </CustomAccordionItem>
            </CustomAccordion>
            <JotaiDemoPriceInfo />
          </Stack>
        ),
      },
    ]}
  />
);

export default CryptoGallery;
