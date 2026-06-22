import { useState } from 'react';

import { Button, SizableText, Toast } from '@onekeyhq/components';
import type { IBip39RevealableSeed } from '@onekeyhq/core/src/secret';
import type { ICurveName } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IRunAppCryptoTestTaskResult } from '@onekeyhq/shared/src/appCrypto/utils';
import { runAppCryptoTestTask } from '@onekeyhq/shared/src/appCrypto/utils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  PartContainer,
  loadCoreSecret,
  runCryptoGalleryTestExclusive,
} from './shared';

export function SecretFunctionsTest() {
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

      const customSalt = bufferUtils.toBuffer(
        '8ff67563c060ca12aac18757221cea72482d139ea65d5f5d4f55a05c69ae87eb',
      );
      const customIv = bufferUtils.toBuffer('ad76f31087e49bbc59ac0f08d679e4c0');
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
      <Button
        variant="primary"
        onPress={() => runCryptoGalleryTestExclusive(testSecretFunctions)}
      >
        Test SecretFunctions
      </Button>
      <Button
        variant="primary"
        onPress={() => runCryptoGalleryTestExclusive(testSecretFunctions2)}
      >
        Test SecretFunctions2
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}
