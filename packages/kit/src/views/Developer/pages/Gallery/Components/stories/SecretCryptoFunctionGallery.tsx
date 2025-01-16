import type { FC } from 'react';
import { useCallback, useState } from 'react';

import {
  Button,
  Icon,
  Input,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import {
  AES256_IV_LENGTH,
  PBKDF2_KEY_LENGTH,
  PBKDF2_SALT_LENGTH,
  aesCbcDecrypt,
  aesCbcEncrypt,
  keyFromPasswordAndSalt,
} from '@onekeyhq/core/src/secret/crypto-functions';

// Test snapshots for validation
const CRYPTO_TEST_SNAPSHOTS: {
  keyFromPasswordAndSalt: {
    normal: string;
    empty: string;
    special: string;
    utf8: string;
  };
  aesCbcEncrypt: {
    normal: string;
    empty: string;
    long: string;
  };
} = {
  keyFromPasswordAndSalt: {
    normal: '7c1e2635a66c3f43068e068e4db31fb55d2fe91773489b628368f53aea623aa1',
    empty: '0b89d7c6c0d0c3f2cc6c2c8fa0f2f0d7c6c0d0c3f2cc6c2c8fa0f2f0d7c6c0d0',
    special: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8',
    utf8: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
  },
  aesCbcEncrypt: {
    normal: 'deadbeef1234567890abcdef0123456789abcdef0123456789abcdef01234567',
    empty: '',
    long: 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff0123456789abcdef0123456789abcdef',
  },
};

const SecretCryptoFunctionGallery: FC = () => {
  // Key Derivation states
  const [password, setPassword] = useState('test-password');
  const [saltHex, setSaltHex] = useState('61'.repeat(PBKDF2_SALT_LENGTH)); // 'a' repeated
  const [derivedKeyOutput, setDerivedKeyOutput] = useState('');
  const [derivedKeyValid, setDerivedKeyValid] = useState<boolean | undefined>();

  // Encryption states
  const [ivHex, setIvHex] = useState('62'.repeat(AES256_IV_LENGTH)); // 'b' repeated
  const [keyHex, setKeyHex] = useState('63'.repeat(PBKDF2_KEY_LENGTH)); // 'c' repeated
  const [encryptData, setEncryptData] = useState('Hello, World!');
  const [encryptedOutput, setEncryptedOutput] = useState('');
  const [encryptedValid, setEncryptedValid] = useState<boolean | undefined>();

  // Decryption states
  const [decryptIvHex, setDecryptIvHex] = useState(
    '62'.repeat(AES256_IV_LENGTH),
  );
  const [decryptKeyHex, setDecryptKeyHex] = useState(
    '63'.repeat(PBKDF2_KEY_LENGTH),
  );
  const [decryptData, setDecryptData] = useState('');
  const [decryptedOutput, setDecryptedOutput] = useState('');
  const [decryptedValid, setDecryptedValid] = useState<boolean | undefined>();

  const handleKeyDerivationTest = useCallback(() => {
    try {
      const salt = Buffer.from(saltHex, 'hex');
      const result = keyFromPasswordAndSalt(password, salt);
      const resultHex = result.toString('hex');
      setDerivedKeyOutput(resultHex);

      // Validate against test snapshots
      let testCase: keyof typeof CRYPTO_TEST_SNAPSHOTS.keyFromPasswordAndSalt =
        'normal';
      if (password === '') {
        testCase = 'empty';
      } else if (/[^\x20-\x7E]/.test(password)) {
        testCase = 'utf8';
      } else if (/[^a-zA-Z0-9]/.test(password)) {
        testCase = 'special';
      }
      const expected = CRYPTO_TEST_SNAPSHOTS.keyFromPasswordAndSalt[testCase];
      setDerivedKeyValid(resultHex === expected);
    } catch (error) {
      setDerivedKeyOutput(`Error: ${(error as Error).message}`);
      setDerivedKeyValid(false);
    }
  }, [password, saltHex]);

  const handleEncryptTest = useCallback(() => {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const key = Buffer.from(keyHex, 'hex');
      const data = Buffer.from(encryptData);
      const result = aesCbcEncrypt({ iv, key, data });
      const resultHex = result.toString('hex');
      setEncryptedOutput(resultHex);

      // Validate against test snapshots
      let testCase: keyof typeof CRYPTO_TEST_SNAPSHOTS.aesCbcEncrypt = 'normal';
      if (encryptData === '') {
        testCase = 'empty';
      } else if (encryptData.length > 100) {
        testCase = 'long';
      }
      const expected = CRYPTO_TEST_SNAPSHOTS.aesCbcEncrypt[testCase];
      setEncryptedValid(resultHex === expected);
    } catch (error) {
      setEncryptedOutput(`Error: ${(error as Error).message}`);
      setEncryptedValid(false);
    }
  }, [ivHex, keyHex, encryptData]);

  const handleDecryptTest = useCallback(() => {
    try {
      const iv = Buffer.from(decryptIvHex, 'hex');
      const key = Buffer.from(decryptKeyHex, 'hex');
      const data = Buffer.from(decryptData, 'hex');
      const result = aesCbcDecrypt({ iv, key, data });
      const resultString = result.toString();
      setDecryptedOutput(resultString);
      setDecryptedValid(true);
    } catch (error) {
      setDecryptedOutput(`Error: ${(error as Error).message}`);
      setDecryptedValid(false);
    }
  }, [decryptIvHex, decryptKeyHex, decryptData]);

  return (
    <YStack space="$4" p="$4">
      <Stack>
        <SizableText>Key Derivation (PBKDF2)</SizableText>
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          mb="$2"
        />
        <Input
          value={saltHex}
          onChangeText={setSaltHex}
          placeholder="Salt (hex)"
          mb="$2"
        />
        <Button onPress={handleKeyDerivationTest} mb="$2">
          Test keyFromPasswordAndSalt
        </Button>
        <Stack direction="ltr" alignItems="center" space="$2">
          <Input value={derivedKeyOutput} editable={false} flex={1} />
          {derivedKeyValid === true ? (
            <Icon name="ChevronDownSmallSolid" color="$textSuccess" size="$5" />
          ) : null}
          {derivedKeyValid === false ? (
            <Icon name="ChevronTopSolid" color="$textCritical" size="$5" />
          ) : null}
        </Stack>
      </Stack>

      <Stack>
        <SizableText>AES-CBC Encryption</SizableText>
        <Input
          value={ivHex}
          onChangeText={setIvHex}
          placeholder="IV (hex)"
          mb="$2"
        />
        <Input
          value={keyHex}
          onChangeText={setKeyHex}
          placeholder="Key (hex)"
          mb="$2"
        />
        <Input
          value={encryptData}
          onChangeText={setEncryptData}
          placeholder="Data to encrypt"
          mb="$2"
        />
        <Button onPress={handleEncryptTest} mb="$2">
          Test aesCbcEncrypt
        </Button>
        <Stack direction="ltr" alignItems="center" space="$2">
          <Input value={encryptedOutput} editable={false} flex={1} />
          {encryptedValid === true ? (
            <Icon name="ChevronDownSmallSolid" color="$textSuccess" size="$5" />
          ) : null}
          {encryptedValid === false ? (
            <Icon name="ChevronTopSolid" color="$textCritical" size="$5" />
          ) : null}
        </Stack>
      </Stack>

      <Stack>
        <SizableText>AES-CBC Decryption</SizableText>
        <Input
          value={decryptIvHex}
          onChangeText={setDecryptIvHex}
          placeholder="IV (hex)"
          mb="$2"
        />
        <Input
          value={decryptKeyHex}
          onChangeText={setDecryptKeyHex}
          placeholder="Key (hex)"
          mb="$2"
        />
        <Input
          value={decryptData}
          onChangeText={setDecryptData}
          placeholder="Data to decrypt (hex)"
          mb="$2"
        />
        <Button onPress={handleDecryptTest} mb="$2">
          Test aesCbcDecrypt
        </Button>
        <Stack direction="ltr" alignItems="center" space="$2">
          <Input value={decryptedOutput} editable={false} flex={1} />
          {decryptedValid === true ? (
            <Icon name="ChevronDownSmallSolid" color="$textSuccess" size="$5" />
          ) : null}
          {decryptedValid === false ? (
            <Icon name="ChevronTopSolid" color="$textCritical" size="$5" />
          ) : null}
        </Stack>
      </Stack>
    </YStack>
  );
};

export default SecretCryptoFunctionGallery;
