import { revealableSeedFromMnemonic } from '@onekeyhq/engine/src/secret';
import bufferUitls from '@onekeyhq/shared/src/utils/bufferUtils';

import { getCurveByImpl } from '../src/managers/impl';
import { fromDBNetworkToNetwork } from '../src/managers/network';
import { Verifier, fromDBNetworkToChainInfo } from '../src/proxy';
import { createVaultSettings } from '../src/vaults/factory.createVaultSettings';

import type { Engine } from '../src';
import type { ExportedCredential } from '../src/dbs/base';
import type { DBNetwork, Network } from '../src/types/network';
import type { IPrepareMockVaultOptions } from './types';

export function prepareMockVault({
  password,
  mnemonic,
  privateKey,
  dbAccount,
  dbNetwork,
}: IPrepareMockVaultOptions) {
  let seedInfo: ExportedCredential | undefined;
  if (mnemonic && password) {
    const rs = revealableSeedFromMnemonic(mnemonic, password);
    seedInfo = {
      ...rs,
      entropy: rs.entropyWithLangPrefixed,
      // @ts-ignore
      parsed: {
        seed: rs.seed.toString('hex'),
        entropy: rs.entropyWithLangPrefixed.toString('hex'),
      },
    };
  }
  if (privateKey && password) {
    const encryptedPrivateKey = bufferUitls.toBuffer(privateKey);
    seedInfo = {
      privateKey: encryptedPrivateKey,
    };
  }

  const networkImpl = dbNetwork.impl;
  const networkId = dbNetwork.id;
  const accountId = dbAccount.id;
  const settings = createVaultSettings({ networkId });
  const network: Network = fromDBNetworkToNetwork(dbNetwork, settings);

  // TODO get curve by networkId
  const curve = getCurveByImpl(networkImpl) as any;

  const engine: Engine = {
    async getNetwork(): Promise<Network> {
      return Promise.resolve(network);
    },
    // @ts-ignore
    providerManager: {
      getVerifier(_networkId: string, pub: string) {
        return new Verifier(pub, curve);
      },
      getChainInfoByNetworkId() {
        return Promise.resolve(fromDBNetworkToChainInfo(dbNetwork));
      },
    },
    // @ts-ignore
    dbApi: {
      getNetwork(): Promise<DBNetwork> {
        return Promise.resolve(dbNetwork);
      },
      getCredential() {
        if (!seedInfo) {
          throw new Error(
            'Credential initialized error, make sure [password, mnemonic] or [privateKey] exists',
          );
        }
        return Promise.resolve(seedInfo);
      },
      getAccount() {
        return Promise.resolve(dbAccount);
      },
    },
  };
  const options = {
    networkId,
    accountId,
    engine,
  };

  return {
    seedInfo,
    networkCurve: curve,
    networkImpl,
    network,
    networkId,
    accountId,
    engine,
    settings,
    options,
    dbAccount,
    dbNetwork,
    password,
    mnemonic,
  };
}
