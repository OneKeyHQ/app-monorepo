import type { FC } from 'react';
import { useCallback, useState } from 'react';

import {
  Button,
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

const SecretHashGallery: FC = () => {
  const [hmac256Key, setHmac256Key] = useState('test-key');
  const [hmac256Data, setHmac256Data] = useState('test-data');
  const [hmac256Output, setHmac256Output] = useState('');

  const [hmac512Key, setHmac512Key] = useState('test-key');
  const [hmac512Data, setHmac512Data] = useState('test-data');
  const [hmac512Output, setHmac512Output] = useState('');

  const [sha256Data, setSha256Data] = useState('test-data');
  const [sha256Output, setSha256Output] = useState('');

  const [hash160Data, setHash160Data] = useState('test-data');
  const [hash160Output, setHash160Output] = useState('');

  const handleHmac256Test = useCallback(() => {
    try {
      const key = Buffer.from(hmac256Key);
      const data = Buffer.from(hmac256Data);
      const result = hmacSHA256(key, data);
      setHmac256Output(result.toString('hex'));
    } catch (error) {
      setHmac256Output(`Error: ${(error as Error).message}`);
    }
  }, [hmac256Key, hmac256Data]);

  const handleHmac512Test = useCallback(() => {
    try {
      const key = Buffer.from(hmac512Key);
      const data = Buffer.from(hmac512Data);
      const result = hmacSHA512(key, data);
      setHmac512Output(result.toString('hex'));
    } catch (error) {
      setHmac512Output(`Error: ${(error as Error).message}`);
    }
  }, [hmac512Key, hmac512Data]);

  const handleSha256Test = useCallback(() => {
    try {
      const data = Buffer.from(sha256Data);
      const result = sha256(data);
      setSha256Output(result.toString('hex'));
    } catch (error) {
      setSha256Output(`Error: ${(error as Error).message}`);
    }
  }, [sha256Data]);

  const handleHash160Test = useCallback(() => {
    try {
      const data = Buffer.from(hash160Data);
      const result = hash160(data);
      setHash160Output(result.toString('hex'));
    } catch (error) {
      setHash160Output(`Error: ${(error as Error).message}`);
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
        <TextArea value={hmac256Output} editable={false} />
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
        <TextArea value={hmac512Output} editable={false} />
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
        <TextArea value={sha256Output} editable={false} />
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
        <TextArea value={hash160Output} editable={false} />
      </Stack>
    </YStack>
  );
};

export default SecretHashGallery;
