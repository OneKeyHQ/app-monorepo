import { useState } from 'react';

import { Button, SizableText, Toast } from '@onekeyhq/components';
import appCrypto from '@onekeyhq/shared/src/appCrypto';

import { PartContainer, runCryptoGalleryTestExclusive } from './shared';

export function PBKDF2Test() {
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
      <Button
        variant="primary"
        onPress={() => runCryptoGalleryTestExclusive(testPBKDF2)}
      >
        Test PBKDF2
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

export function HashTest() {
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
      <Button
        variant="primary"
        onPress={() => runCryptoGalleryTestExclusive(testHash)}
      >
        Test Hash
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

export function KeyGenTest() {
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
      <Button
        variant="primary"
        onPress={() => runCryptoGalleryTestExclusive(testKeyGen)}
      >
        Test KeyGen
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}

export function AESCbcTest() {
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
      <Button
        variant="primary"
        onPress={() => runCryptoGalleryTestExclusive(testAESCbc)}
      >
        Test AES-CBC
      </Button>
      {result ? <SizableText size="$bodyMd">{result}</SizableText> : null}
    </PartContainer>
  );
}
