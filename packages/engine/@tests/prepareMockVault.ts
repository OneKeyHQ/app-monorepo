import { revealableSeedFromMnemonic } from '@onekeyhq/core/src/secret';
import bufferUitls from '@onekeyhq/shared/src/utils/bufferUtils';

import { getCurveByImpl } from '../src/managers/impl';
import { fromDBNetworkToNetwork } from '../src/managers/network';
import { Verifier, fromDBNetworkToChainInfo } from '../src/proxy';
import { createVaultSettings } from '../src/vaults/factory.createVaultSettings';

import type { Engine } from '../src';
import type { ExportedCredential } from '../src/dbs/base';
import type { DBNetwork, Network } from '../src/types/network';
import type { Token } from '../src/types/token';
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
      type: 'imported',
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
    async ensureTokenInDB(): Promise<Token | undefined> {
      return Promise.resolve({
        '_id': '63455df060ad34cc8f4c23d5',
        'name': dbNetwork.name,
        'address': '',
        'symbol': dbNetwork.symbol,
        'decimals': dbNetwork.decimals,
        'logoURI': dbNetwork.logoURI,
        'coingeckoId': '',
        'status': 'LISTED',
        'impl': dbNetwork.impl,
        'chainId': dbNetwork.id.split('--').pop(),
        'checked': true,
        'isNative': true,
        'addToIndex': true,
        'source': '',
        'riskLevel': 0,
        'id': dbNetwork.id,
        'networkId': dbNetwork.id,
        'tokenIdOnNetwork': '',
      });
    },
    getChainInfo() {
      return Promise.resolve(fromDBNetworkToChainInfo(dbNetwork));
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
