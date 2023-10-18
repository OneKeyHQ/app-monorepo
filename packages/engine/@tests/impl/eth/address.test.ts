import { keccak256 } from '@ethersproject/keccak256';
import { ethers } from 'ethers';

import { slicePathTemplate } from '../../../src/managers/derivation';
import { batchGetPublicKeys, uncompressPublicKey } from '../../../src/secret';
import fixtures from '../fixtures/ethAddress';
import { mnemonicToCredential } from '../fixtures/utils';

import type { IPrepareSoftwareAccountsParams } from '../../../src/vaults/types';

function pubkeyToAddress(pub: string) {
  const compressedPublicKey = Buffer.from(pub, 'hex');
  const uncompressedPublicKey = uncompressPublicKey(
    'secp256k1',
    compressedPublicKey,
  );
  return `0x${keccak256(uncompressedPublicKey.slice(-64)).slice(-40)}`;
}

async function prepareAccount(
  params: IPrepareSoftwareAccountsParams,
  mnemonic: string,
) {
  const { password, indexes, template } = params;
  const { seed } = await mnemonicToCredential(mnemonic, password);

  const { pathPrefix, pathSuffix } = slicePathTemplate(template);
  const pubkeyInfos = batchGetPublicKeys(
    'secp256k1',
    seed,
    password,
    pathPrefix,
    indexes.map((index) => pathSuffix.replace('{index}', index.toString())),
  );

  if (pubkeyInfos.length !== indexes.length) {
    throw new Error('Unable to get publick key.');
  }

  const result: string[] = [];
  const paths: string[] = [];
  for (const info of pubkeyInfos) {
    const {
      path,
      extendedKey: { key: pubkey },
    } = info;
    const pub = pubkey.toString('hex');
    const address = pubkeyToAddress(pub);
    paths.push(path);
    result.push(ethers.utils.getAddress(address));
  }

  return result;
}

describe('Ethereum keypair', () => {
  fixtures.forEach((f) => {
    it(f.description, async () => {
      const response = await prepareAccount(
        f.params.prepareAccountParams,
        f.params.mnemonic,
      );
      expect(response).toEqual(f.response);
    });
  });
});
