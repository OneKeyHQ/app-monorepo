import type { FC } from 'react';
import { useCallback, useState } from 'react';

import {
  Button,
  Icon,
  Input,
  SizableText,
  Stack,
  TextArea,
  YStack,
} from '@onekeyhq/components';
import {
  hash160,
  hmacSHA256,
  hmacSHA512,
  sha256,
} from '@onekeyhq/core/src/secret/hash';

const HASH_TEST_SNAPSHOTS = {
  hmacSHA256: {
    normal: '21a286fd6fd9f52676007c66d0f883db46d06158c266d33fb537c23bc618e567',
    emptyData: '2711cc23e9ab1b8a9bc0fe991238da92671624a9ebdaf1c1abec06e7e9a14f9b',
    emptyKey: '51931855b3cc798605f46274a97c2b8a4879b871bb814a0696031c8ba307f6a0',
  },
  hmacSHA512: {
    normal: '080e166f475f1c5d61f26b94d45a0cd822729a525e3a3865b87cdf58a36f039ea1948735aab3ad5027d553ad06487fb57d3a9034d2861300297d6cebf838f5bf',
    emptyData: 'd79bf88724d52a1cccf5a0a3ca1b6c803c96dba1c0229b4aa1d7c449eae348fced07751c55d2dbb535b354e7f12dbeb060a4febc6c28c92fadc8f11fb4ee25e0',
    emptyKey: '3886f0e449dda34f64d9cd3020edfa24fbb7e4e29962c072fe8018229465c4a1d196fce4ac5a378a42f2b63bab1f9208033dddd7d3acd8ce7907548caad93836',
  },
  sha256: {
    normal: 'a186000422feab857329c684e9fe91412b1a5db084100b37a98cfc95b62aa867',
    emptyData: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  hash160: {
    normal: 'a54bc3b936756940bc8c80713f3ebb0efa870eed',
    emptyData: 'b472a266d0bd89c13706a4132ccfb16f7c3b9fcb',
  },
} as const;

const SecretHashGallery: FC = (): JSX.Element => {
  // HMAC SHA256 states
  const [hmac256Key, setHmac256Key] = useState('test-key');
  const [hmac256Data, setHmac256Data] = useState('test-data');
  const [hmac256Output, setHmac256Output] = useState('');
  const [hmac256Valid, setHmac256Valid] = useState<boolean | undefined>();

  // HMAC SHA512 states
  const [hmac512Key, setHmac512Key] = useState('test-key');
  const [hmac512Data, setHmac512Data] = useState('test-data');
  const [hmac512Output, setHmac512Output] = useState('');
  const [hmac512Valid, setHmac512Valid] = useState<boolean | undefined>();

  // SHA256 states
  const [sha256Data, setSha256Data] = useState('test-data');
  const [sha256Output, setSha256Output] = useState('');
  const [sha256Valid, setSha256Valid] = useState<boolean | undefined>();

  // Hash160 states
  const [hash160Data, setHash160Data] = useState('test-data');
  const [hash160Output, setHash160Output] = useState('');
  const [hash160Valid, setHash160Valid] = useState<boolean | undefined>();

  const handleHmac256Test = useCallback(() => {
    try {
      const key = Buffer.from(hmac256Key);
      const data = Buffer.from(hmac256Data);
      const result = hmacSHA256(key, data);
      const resultHex = result.toString('hex');
      setHmac256Output(resultHex);

      // Validate against test snapshots
      const testCase = key.length === 0 
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

  const handleHmac512Test = useCallback(() => {
    try {
      const key = Buffer.from(hmac512Key);
      const data = Buffer.from(hmac512Data);
      const result = hmacSHA512(key, data);
      const resultHex = result.toString('hex');
      setHmac512Output(resultHex);

      // Validate against test snapshots
      const testCase = key.length === 0 
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

  const handleSha256Test = useCallback(() => {
    try {
      const data = Buffer.from(sha256Data);
      const result = sha256(data);
      const resultHex = result.toString('hex');
      setSha256Output(resultHex);

      // Validate against test snapshots
      const testCase = data.length === 0 ? 'emptyData' : 'normal';
      const expected = HASH_TEST_SNAPSHOTS.sha256[testCase];
      setSha256Valid(resultHex === expected);
    } catch (error) {
      setSha256Output(`Error: ${(error as Error).message}`);
      setSha256Valid(false);
    }
  }, [sha256Data]);

  const handleHash160Test = useCallback(() => {
    try {
      const data = Buffer.from(hash160Data);
      const result = hash160(data);
      const resultHex = result.toString('hex');
      setHash160Output(resultHex);

      // Validate against test snapshots
      const testCase = data.length === 0 ? 'emptyData' : 'normal';
      const expected = HASH_TEST_SNAPSHOTS.hash160[testCase];
      setHash160Valid(resultHex === expected);
    } catch (error) {
      setHash160Output(`Error: ${(error as Error).message}`);
      setHash160Valid(false);
    }
  }, [hash160Data]);

  return (
    <YStack space="$4" p="$4">
      <Stack>
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
        <Button onPress={handleHmac256Test} mb="$2">
          Test hmacSHA256
        </Button>
        <Stack direction="ltr" alignItems="center" space="$2">
          <TextArea value={hmac256Output} editable={false} flex={1} />
          {hmac256Valid === true && <Icon name="TxStatusSuccessCircleIllus" color="$iconSuccess" size="$6" />}
          {hmac256Valid === false && <Icon name="TxStatusFailureCircleIllus" color="$iconCritical" size="$6" />}
        </Stack>
      </Stack>

      <Stack>
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
        <Button onPress={handleHmac512Test} mb="$2">
          Test hmacSHA512
        </Button>
        <Stack direction="ltr" alignItems="center" space="$2">
          <TextArea value={hmac512Output} editable={false} flex={1} />
          {hmac512Valid === true && <Icon name="TxStatusSuccessCircleIllus" color="$iconSuccess" size="$6" />}
          {hmac512Valid === false && <Icon name="TxStatusFailureCircleIllus" color="$iconCritical" size="$6" />}
        </Stack>
      </Stack>

      <Stack>
        <SizableText>SHA256</SizableText>
        <Input
          value={sha256Data}
          onChangeText={setSha256Data}
          placeholder="Data"
          mb="$2"
        />
        <Button onPress={handleSha256Test} mb="$2">
          Test sha256
        </Button>
        <Stack direction="ltr" alignItems="center" space="$2">
          <TextArea value={sha256Output} editable={false} flex={1} />
          {sha256Valid === true && <Icon name="TxStatusSuccessCircleIllus" color="$iconSuccess" size="$6" />}
          {sha256Valid === false && <Icon name="TxStatusFailureCircleIllus" color="$iconCritical" size="$6" />}
        </Stack>
      </Stack>

      <Stack>
        <SizableText>Hash160</SizableText>
        <Input
          value={hash160Data}
          onChangeText={setHash160Data}
          placeholder="Data"
          mb="$2"
        />
        <Button onPress={handleHash160Test} mb="$2">
          Test hash160
        </Button>
        <Stack direction="ltr" alignItems="center" space="$2">
          <TextArea value={hash160Output} editable={false} flex={1} />
          {hash160Valid === true && <Icon name="TxStatusSuccessCircleIllus" color="$iconSuccess" size="$6" />}
          {hash160Valid === false && <Icon name="TxStatusFailureCircleIllus" color="$iconCritical" size="$6" />}
        </Stack>
      </Stack>
    </YStack>
  );
};

export default SecretHashGallery;
