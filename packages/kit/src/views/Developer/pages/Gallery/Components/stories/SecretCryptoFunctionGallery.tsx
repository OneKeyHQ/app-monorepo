/* eslint-disable no-nested-ternary */
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

import { Layout } from './utils/Layout';

// Test snapshots for validation
const CRYPTO_TEST_SNAPSHOTS: {
  keyFromPasswordAndSalt: string;
  aesCbcEncrypt: string;
  aesCbcDecrypt: string;
} = {
  keyFromPasswordAndSalt:
    '2e90bd72bd2580bdf52e85ff316a3b551fa8c9133bc92a5ada7ba1e7f452df02',
  aesCbcEncrypt: '4919bcae82be9c9a490b1ffb58c33d9a',
  aesCbcDecrypt: '48656c6c6f2c20576f726c6421',
};

const SecretCryptoFunction: FC = () => {
  // Key Derivation states
  const [password, setPassword] = useState('test-password');
  const [saltHex, setSaltHex] = useState(
    Buffer.alloc(PBKDF2_SALT_LENGTH, 'a').toString('hex'),
  ); // 'a' repeated
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
    Buffer.alloc(AES256_IV_LENGTH, 'd').toString('hex'),
  );
  const [decryptKeyHex, setDecryptKeyHex] = useState(
    Buffer.alloc(PBKDF2_KEY_LENGTH, 'c').toString('hex'),
  );
  const [decryptData, setDecryptData] = useState('Hello, World!');
  const [decryptedOutput, setDecryptedOutput] = useState('');
  const [decryptedValid, setDecryptedValid] = useState<boolean | undefined>();

  const handleKeyDerivationTest = useCallback(() => {
    try {
      const salt = Buffer.from(saltHex, 'hex');
      const result = keyFromPasswordAndSalt(password, salt);
      const resultHex = result.toString('hex');
      setDerivedKeyOutput(resultHex);

      // Validate against test snapshots
      const expected = CRYPTO_TEST_SNAPSHOTS.keyFromPasswordAndSalt;
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
      const expected = CRYPTO_TEST_SNAPSHOTS.aesCbcEncrypt;
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
      const encrypted = aesCbcEncrypt({
        iv,
        key,
        data: Buffer.from(decryptData),
      });

      const result = aesCbcDecrypt({ iv, key, data: encrypted });
      const expected = result.toString('hex');
      setDecryptedOutput(expected);
      setDecryptedValid(expected === CRYPTO_TEST_SNAPSHOTS.aesCbcDecrypt);
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
          {derivedKeyValid !== undefined ? (
            derivedKeyValid ? (
              <Icon
                name="TxStatusSuccessCircleIllus"
                color="$iconSuccess"
                size="$6"
              />
            ) : (
              <Icon
                name="TxStatusFailureCircleIllus"
                color="$iconCritical"
                size="$6"
              />
            )
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
          {encryptedValid !== undefined ? (
            encryptedValid ? (
              <Icon
                name="TxStatusSuccessCircleIllus"
                color="$iconSuccess"
                size="$6"
              />
            ) : (
              <Icon
                name="TxStatusFailureCircleIllus"
                color="$iconCritical"
                size="$6"
              />
            )
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
          {decryptedValid !== undefined ? (
            decryptedValid ? (
              <Icon
                name="TxStatusSuccessCircleIllus"
                color="$iconSuccess"
                size="$6"
              />
            ) : (
              <Icon
                name="TxStatusFailureCircleIllus"
                color="$iconCritical"
                size="$6"
              />
            )
          ) : null}
        </Stack>
      </Stack>
    </YStack>
  );
};

function SecretCryptoFunctionGallery() {
  return (
    <Layout
      description=".."
      suggestions={['...']}
      boundaryConditions={['...']}
      elements={[
        {
          title: 'Default',
          element: <SecretCryptoFunction />,
        },
      ]}
    />
  );
}
export default SecretCryptoFunctionGallery;
