import { keccak256 } from '@ethersproject/keccak256';
import * as bip39 from 'bip39';

import { getPathPrefix } from '../../../src/managers/derivation';
import {
  batchGetPublicKeys,
  revealableSeedFromMnemonic,
  uncompressPublicKey,
} from '../../../src/secret';
import fixtures from '../fixtures/ethAddress';

import type { IPrepareSoftwareAccountsParams } from '../../../src/vaults/types';

async function validateMnemonic(mnemonic: string): Promise<string> {
  const usedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
  if (!bip39.validateMnemonic(usedMnemonic)) {
    throw new Error('InvalidMnemonic');
  }
  return Promise.resolve(usedMnemonic);
}

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
  const usedMnemonic = await validateMnemonic(mnemonic);
  const rs = revealableSeedFromMnemonic(usedMnemonic, password);
  const { seed } = rs;

  const pathPrefix = getPathPrefix(template);
  const pubkeyInfos = batchGetPublicKeys(
    'secp256k1',
    seed,
    password,
    pathPrefix,
    indexes.map((index) => index.toString()),
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
    result.push(address);
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
