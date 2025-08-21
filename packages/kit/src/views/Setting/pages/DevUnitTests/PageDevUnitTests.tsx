/* eslint-disable no-nested-ternary */
import { useCallback, useState } from 'react';

import {
  Button,
  Icon,
  Input,
  Page,
  SizableText,
  Stack,
  TextAreaInput,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  hash160,
  hmacSHA256,
  hmacSHA512,
  sha256,
} from '@onekeyhq/core/src/secret/hash';
import appCrypto from '@onekeyhq/shared/src/appCrypto';

const { aesCbcDecrypt: aesCbcDecryptAsync, aesCbcEncrypt: aesCbcEncryptAsync } =
  appCrypto.aesCbc;

const { keyFromPasswordAndSalt } = appCrypto.keyGen;

const { AES256_IV_LENGTH, PBKDF2_KEY_LENGTH, PBKDF2_SALT_LENGTH } =
  appCrypto.consts;

// Test snapshots for validation
const HASH_TEST_SNAPSHOTS = {
  hmacSHA256: {
    normal: '21a286fd6fd9f52676007c66d0f883db46d06158c266d33fb537c23bc618e567',
    emptyData:
      '2711cc23e9ab1b8a9bc0fe991238da92671624a9ebdaf1c1abec06e7e9a14f9b',
    emptyKey:
      '51931855b3cc798605f46274a97c2b8a4879b871bb814a0696031c8ba307f6a0',
  },
  hmacSHA512: {
    normal:
      '080e166f475f1c5d61f26b94d45a0cd822729a525e3a3865b87cdf58a36f039ea1948735aab3ad5027d553ad06487fb57d3a9034d2861300297d6cebf838f5bf',
    emptyData:
      'd79bf88724d52a1cccf5a0a3ca1b6c803c96dba1c0229b4aa1d7c449eae348fced07751c55d2dbb535b354e7f12dbeb060a4febc6c28c92fadc8f11fb4ee25e0',
    emptyKey:
      '3886f0e449dda34f64d9cd3020edfa24fbb7e4e29962c072fe8018229465c4a1d196fce4ac5a378a42f2b63bab1f9208033dddd7d3acd8ce7907548caad93836',
  },
  sha256: {
    normal: 'a186000422feab857329c684e9fe91412b1a5db084100b37a98cfc95b62aa867',
    emptyData:
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  hash160: {
    normal: 'a54bc3b936756940bc8c80713f3ebb0efa870eed',
    emptyData: 'b472a266d0bd89c13706a4132ccfb16f7c3b9fcb',
  },
};

const CRYPTO_TEST_SNAPSHOTS = {
  keyFromPasswordAndSalt:
    '2e90bd72bd2580bdf52e85ff316a3b551fa8c9133bc92a5ada7ba1e7f452df02',
  aesCbcEncrypt: '4919bcae82be9c9a490b1ffb58c33d9a',
  aesCbcDecrypt: '48656c6c6f2c20576f726c6421',
};

export default function PageDevUnitTests() {
  // Hash Function States
  const [hmac256Key, setHmac256Key] = useState('test-key');
  const [hmac256Data, setHmac256Data] = useState('test-data');
  const [hmac256Output, setHmac256Output] = useState('');
  const [hmac256Valid, setHmac256Valid] = useState<boolean | undefined>();

  const [hmac512Key, setHmac512Key] = useState('test-key');
  const [hmac512Data, setHmac512Data] = useState('test-data');
  const [hmac512Output, setHmac512Output] = useState('');
  const [hmac512Valid, setHmac512Valid] = useState<boolean | undefined>();

  const [sha256Data, setSha256Data] = useState('test-data');
  const [sha256Output, setSha256Output] = useState('');
  const [sha256Valid, setSha256Valid] = useState<boolean | undefined>();

  const [hash160Data, setHash160Data] = useState('test-data');
  const [hash160Output, setHash160Output] = useState('');
  const [hash160Valid, setHash160Valid] = useState<boolean | undefined>();

  // Crypto Function States
  const [password, setPassword] = useState('test-password');
  const [saltHex, setSaltHex] = useState(
    Buffer.alloc(PBKDF2_SALT_LENGTH, 'a').toString('hex'),
  );
  const [derivedKeyOutput, setDerivedKeyOutput] = useState('');
  const [derivedKeyValid, setDerivedKeyValid] = useState<boolean | undefined>();

  const [ivHex, setIvHex] = useState('62'.repeat(AES256_IV_LENGTH));
  const [keyHex, setKeyHex] = useState('63'.repeat(PBKDF2_KEY_LENGTH));
  const [encryptData, setEncryptData] = useState('Hello, World!');
  const [encryptedOutput, setEncryptedOutput] = useState('');
  const [encryptedValid, setEncryptedValid] = useState<boolean | undefined>();

  const [decryptIvHex, setDecryptIvHex] = useState(
    Buffer.alloc(AES256_IV_LENGTH, 'd').toString('hex'),
  );
  const [decryptKeyHex, setDecryptKeyHex] = useState(
    Buffer.alloc(PBKDF2_KEY_LENGTH, 'c').toString('hex'),
  );
  const [decryptData, setDecryptData] = useState('Hello, World!');
  const [decryptedOutput, setDecryptedOutput] = useState('');
  const [decryptedValid, setDecryptedValid] = useState<boolean | undefined>();

  // Hash Function Handlers
  const handleHmac256Test = useCallback(async () => {
    try {
      const key = Buffer.from(hmac256Key);
      const data = Buffer.from(hmac256Data);
      const result = await hmacSHA256(key, data);
      const resultHex = result.toString('hex');
      setHmac256Output(resultHex);

      const testCase =
        key.length === 0
          ? 'emptyKey'
          : data.length === 0
          ? 'emptyData'
          : 'normal';
      const expected = HASH_TEST_SNAPSHOTS.hmacSHA256[testCase];
      setHmac256Valid(resultHex === expected);
    } catch (error) {
      setHmac256Output(`Error: ${(error as Error).message}`);
      setHmac256Valid(false);
    }
  }, [hmac256Key, hmac256Data]);

  const handleHmac512Test = useCallback(async () => {
    try {
      const key = Buffer.from(hmac512Key);
      const data = Buffer.from(hmac512Data);
      const result = await hmacSHA512(key, data);
      const resultHex = result.toString('hex');
      setHmac512Output(resultHex);

      const testCase =
        key.length === 0
          ? 'emptyKey'
          : data.length === 0
          ? 'emptyData'
          : 'normal';
      const expected = HASH_TEST_SNAPSHOTS.hmacSHA512[testCase];
      setHmac512Valid(resultHex === expected);
    } catch (error) {
      setHmac512Output(`Error: ${(error as Error).message}`);
      setHmac512Valid(false);
    }
  }, [hmac512Key, hmac512Data]);

  const handleSha256Test = useCallback(async () => {
    try {
      const data = Buffer.from(sha256Data);
      const result = await sha256(data);
      const resultHex = result.toString('hex');
      setSha256Output(resultHex);

      const testCase = data.length === 0 ? 'emptyData' : 'normal';
      const expected = HASH_TEST_SNAPSHOTS.sha256[testCase];
      setSha256Valid(resultHex === expected);
    } catch (error) {
      setSha256Output(`Error: ${(error as Error).message}`);
      setSha256Valid(false);
    }
  }, [sha256Data]);

  const handleHash160Test = useCallback(async () => {
    try {
      const data = Buffer.from(hash160Data);
      const result = await hash160(data);
      const resultHex = result.toString('hex');
      setHash160Output(resultHex);

      const testCase = data.length === 0 ? 'emptyData' : 'normal';
      const expected = HASH_TEST_SNAPSHOTS.hash160[testCase];
      setHash160Valid(resultHex === expected);
    } catch (error) {
      setHash160Output(`Error: ${(error as Error).message}`);
      setHash160Valid(false);
    }
  }, [hash160Data]);

  // Crypto Function Handlers
  const handleKeyDerivationTest = useCallback(async () => {
    try {
      const salt = Buffer.from(saltHex, 'hex');
      const result = await keyFromPasswordAndSalt({
        password,
        salt,
      });
      const resultHex = result.toString('hex');
      setDerivedKeyOutput(resultHex);

      const expected = CRYPTO_TEST_SNAPSHOTS.keyFromPasswordAndSalt;
      setDerivedKeyValid(resultHex === expected);
    } catch (error) {
      setDerivedKeyOutput(`Error: ${(error as Error).message}`);
      setDerivedKeyValid(false);
    }
  }, [password, saltHex]);

  const handleEncryptTest = useCallback(async () => {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const key = Buffer.from(keyHex, 'hex');
      const data = Buffer.from(encryptData);
      const result = await aesCbcEncryptAsync({ iv, key, data });
      const resultHex = result.toString('hex');
      setEncryptedOutput(resultHex);

      const expected = CRYPTO_TEST_SNAPSHOTS.aesCbcEncrypt;
      setEncryptedValid(resultHex === expected);
    } catch (error) {
      setEncryptedOutput(`Error: ${(error as Error).message}`);
      setEncryptedValid(false);
    }
  }, [ivHex, keyHex, encryptData]);

  const handleDecryptTest = useCallback(async () => {
    try {
      const iv = Buffer.from(decryptIvHex, 'hex');
      const key = Buffer.from(decryptKeyHex, 'hex');
      const encrypted = await aesCbcEncryptAsync({
        iv,
        key,
        data: Buffer.from(decryptData),
      });

      const result = await aesCbcDecryptAsync({ iv, key, data: encrypted });
      const expected = result.toString('hex');
      setDecryptedOutput(expected);
      setDecryptedValid(expected === CRYPTO_TEST_SNAPSHOTS.aesCbcDecrypt);
    } catch (error) {
      setDecryptedOutput(`Error: ${(error as Error).message}`);
      setDecryptedValid(false);
    }
  }, [decryptIvHex, decryptKeyHex, decryptData]);

  return (
    <Page scrollEnabled>
      <Page.Header title="Dev Unit Tests" />
      <YStack gap="$8" p="$4">
        {/* Hash Functions */}
        <Stack gap="$6">
          <SizableText size="$headingLg">Hash Functions</SizableText>

          <Stack gap="$4">
            <SizableText>HMAC SHA256</SizableText>
            <Input
              value={hmac256Key}
              onChangeText={setHmac256Key}
              placeholder="Key"
              mb="$2"
            />
            <Input
              value={hmac256Data}
              onChangeText={setHmac256Data}
              placeholder="Data"
              mb="$2"
            />
            <XStack alignItems="center" gap="$2">
              <Button
                flex={1}
                variant="primary"
                onPress={handleHmac256Test}
                mb="$2"
              >
                Test hmacSHA256
              </Button>
              {hmac256Valid !== undefined ? (
                <Icon
                  name={
                    hmac256Valid
                      ? 'TxStatusSuccessCircleIllus'
                      : 'TxStatusFailureCircleIllus'
                  }
                  color={hmac256Valid ? '$iconSuccess' : '$iconCritical'}
                  size="$6"
                />
              ) : null}
            </XStack>
            <Stack>
              <TextAreaInput value={hmac256Output} editable={false} flex={1} />
            </Stack>
          </Stack>

          <Stack gap="$4">
            <SizableText>HMAC SHA512</SizableText>
            <Input
              value={hmac512Key}
              onChangeText={setHmac512Key}
              placeholder="Key"
              mb="$2"
            />
            <Input
              value={hmac512Data}
              onChangeText={setHmac512Data}
              placeholder="Data"
              mb="$2"
            />
            <XStack alignItems="center" gap="$2">
              <Button
                flex={1}
                variant="primary"
                onPress={handleHmac512Test}
                mb="$2"
              >
                Test hmacSHA512
              </Button>
              {hmac512Valid !== undefined ? (
                <Icon
                  name={
                    hmac512Valid
                      ? 'TxStatusSuccessCircleIllus'
                      : 'TxStatusFailureCircleIllus'
                  }
                  color={hmac512Valid ? '$iconSuccess' : '$iconCritical'}
                  size="$6"
                />
              ) : null}
            </XStack>
            <Stack>
              <TextAreaInput value={hmac512Output} editable={false} flex={1} />
            </Stack>
          </Stack>

          <Stack gap="$4">
            <SizableText>SHA256</SizableText>
            <Input
              value={sha256Data}
              onChangeText={setSha256Data}
              placeholder="Data"
              mb="$2"
            />
            <XStack alignItems="center" gap="$2">
              <Button
                flex={1}
                variant="primary"
                onPress={handleSha256Test}
                mb="$2"
              >
                Test sha256
              </Button>
              {sha256Valid !== undefined ? (
                <Icon
                  name={
                    sha256Valid
                      ? 'TxStatusSuccessCircleIllus'
                      : 'TxStatusFailureCircleIllus'
                  }
                  color={sha256Valid ? '$iconSuccess' : '$iconCritical'}
                  size="$6"
                />
              ) : null}
            </XStack>
            <Stack>
              <TextAreaInput value={sha256Output} editable={false} flex={1} />
            </Stack>
          </Stack>

          <Stack gap="$4">
            <SizableText>Hash160</SizableText>
            <Input
              value={hash160Data}
              onChangeText={setHash160Data}
              placeholder="Data"
              mb="$2"
            />
            <XStack alignItems="center" gap="$2">
              <Button
                flex={1}
                variant="primary"
                onPress={handleHash160Test}
                mb="$2"
              >
                Test hash160
              </Button>
              {hash160Valid !== undefined ? (
                <Icon
                  name={
                    hash160Valid
                      ? 'TxStatusSuccessCircleIllus'
                      : 'TxStatusFailureCircleIllus'
                  }
                  color={hash160Valid ? '$iconSuccess' : '$iconCritical'}
                  size="$6"
                />
              ) : null}
            </XStack>
            <Stack>
              <TextAreaInput value={hash160Output} editable={false} flex={1} />
            </Stack>
          </Stack>
        </Stack>

        {/* Crypto Functions */}
        <Stack gap="$6">
          <SizableText size="$headingLg">Crypto Functions</SizableText>

          <Stack gap="$4">
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
            <XStack alignItems="center" gap="$2">
              <Button
                flex={1}
                variant="primary"
                onPress={handleKeyDerivationTest}
                mb="$2"
              >
                Test keyFromPasswordAndSalt
              </Button>
              {derivedKeyValid !== undefined ? (
                <Icon
                  name={
                    derivedKeyValid
                      ? 'TxStatusSuccessCircleIllus'
                      : 'TxStatusFailureCircleIllus'
                  }
                  color={derivedKeyValid ? '$iconSuccess' : '$iconCritical'}
                  size="$6"
                />
              ) : null}
            </XStack>
            <Stack>
              <TextAreaInput
                value={derivedKeyOutput}
                editable={false}
                flex={1}
              />
            </Stack>
          </Stack>

          <Stack gap="$4">
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
            <XStack alignItems="center" gap="$2">
              <Button
                flex={1}
                variant="primary"
                onPress={handleEncryptTest}
                mb="$2"
              >
                Test aesCbcEncrypt
              </Button>
              {encryptedValid !== undefined ? (
                <Icon
                  name={
                    encryptedValid
                      ? 'TxStatusSuccessCircleIllus'
                      : 'TxStatusFailureCircleIllus'
                  }
                  color={encryptedValid ? '$iconSuccess' : '$iconCritical'}
                  size="$6"
                />
              ) : null}
            </XStack>
            <Stack>
              <TextAreaInput
                value={encryptedOutput}
                editable={false}
                flex={1}
              />
            </Stack>
          </Stack>

          <Stack gap="$4">
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
              placeholder="Data to decrypt"
              mb="$2"
            />
            <XStack alignItems="center" gap="$2">
              <Button
                variant="primary"
                flex={1}
                onPress={handleDecryptTest}
                mb="$2"
              >
                Test aesCbcDecrypt
              </Button>
              {decryptedValid !== undefined ? (
                <Icon
                  name={
                    decryptedValid
                      ? 'TxStatusSuccessCircleIllus'
                      : 'TxStatusFailureCircleIllus'
                  }
                  color={decryptedValid ? '$iconSuccess' : '$iconCritical'}
                  size="$6"
                />
              ) : null}
            </XStack>
            <Stack>
              <TextAreaInput
                value={decryptedOutput}
                editable={false}
                width="100%"
              />
            </Stack>
          </Stack>
        </Stack>
      </YStack>
    </Page>
  );
}
