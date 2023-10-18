import { PublicKey } from '@solana/web3.js';

import { slicePathTemplate } from '../../../src/managers/derivation';
import { batchGetPublicKeys } from '../../../src/secret';
import fixtures from '../fixtures/solAddress';
import { mnemonicToCredential } from '../fixtures/utils';

import type { IPrepareSoftwareAccountsParams } from '../../../src/vaults/types';

async function prepareAccount(
  params: IPrepareSoftwareAccountsParams,
  mnemonic: string,
) {
  const { password, indexes, template } = params;
  const { seed } = await mnemonicToCredential(mnemonic, password);

  const { pathPrefix, pathSuffix } = slicePathTemplate(template);
  const pubkeyInfos = batchGetPublicKeys(
    'ed25519',
    seed,
    password,
    pathPrefix,
    indexes.map((index) => pathSuffix.replace('{index}', index.toString())),
  );

  if (pubkeyInfos.length !== indexes.length) {
    throw new Error('Unable to get public keys');
  }

  const result: string[] = [];
  const paths: string[] = [];

  for (const info of pubkeyInfos) {
    const {
      path,
      extendedKey: { key: pubkey },
    } = info;
    const address = new PublicKey(pubkey).toBase58();
    paths.push(path);
    result.push(address);
  }

  return result;
}

describe('SOLANA keypair', () => {
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
