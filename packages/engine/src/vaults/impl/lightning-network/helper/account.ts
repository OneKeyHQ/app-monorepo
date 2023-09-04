import bs58check from 'bs58check';

import { Provider } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/provider/provider';
import {
  COINTYPE_BTC,
  COINTYPE_TBTC,
  IMPL_BTC,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { batchGetPublicKeys } from '../../../../secret';
import { getAccountDefaultByPurpose } from '../../../utils/btcForkChain/utils';

import type { Engine } from '../../../..';

export const getBtcProvider = async (engine: Engine, isTestnet: boolean) => {
  const chainInfo = await engine.providerManager.getChainInfoByNetworkId(
    isTestnet ? 'tbtc--0' : 'btc--0',
  );
  const provider = new Provider(chainInfo);
  return provider;
};

export const generateNativeSegwitAccounts = async ({
  engine,
  seed,
  password,
  indexes,
  names,
  isTestnet,
}: {
  engine: Engine;
  seed: Buffer;
  password: string;
  indexes: number[];
  names?: string[];
  isTestnet: boolean;
}) => {
  const provider = await getBtcProvider(engine, isTestnet);
  const { network } = provider;
  const IMPL = isTestnet ? IMPL_TBTC : IMPL_BTC;
  const CoinType = isTestnet ? COINTYPE_TBTC : COINTYPE_BTC;
  const { addressEncoding } = getAccountDefaultByPurpose(84, IMPL);
  console.log('=====>>>>> : ', provider);
  const ignoreFirst = indexes[0] !== 0;
  const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];
  const pubkeyInfos = batchGetPublicKeys(
    'secp256k1',
    seed,
    password,
    `m/84'/${CoinType}'`,
    usedIndexes.map((index) => `${index.toString()}'`),
  );
  if (pubkeyInfos.length !== usedIndexes.length) {
    throw new OneKeyInternalError('Unable to get publick key.');
  }
  const { public: xpubVersionBytes } =
    (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

  const ret = [];
  let index = 0;
  for (const { path, parentFingerPrint, extendedKey } of pubkeyInfos) {
    const xpub = bs58check.encode(
      Buffer.concat([
        Buffer.from(xpubVersionBytes.toString(16).padStart(8, '0'), 'hex'),
        Buffer.from([3]),
        parentFingerPrint,
        Buffer.from(
          (usedIndexes[index] + 2 ** 31).toString(16).padStart(8, '0'),
          'hex',
        ),
        extendedKey.chainCode,
        extendedKey.key,
      ]),
    );
    const firstAddressRelPath = '0/0';
    const { [firstAddressRelPath]: address } = provider.xpubToAddresses(
      xpub,
      [firstAddressRelPath],
      addressEncoding,
    );
    const prefix = isTestnet ? 'TLightning' : 'Lightning';
    const name = (names || [])[index] || `${prefix} #${usedIndexes[index] + 1}`;
    if (!ignoreFirst || index > 0) {
      ret.push({
        index: usedIndexes[index],
        name,
        path,
        xpub,
        address,
      });
    }
    index += 1;
  }
  return ret;
};
