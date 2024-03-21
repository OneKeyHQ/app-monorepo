import { mnemonicToSeedSync } from 'bip39';
import bs58check from 'bs58check';

import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { batchGetPublicKeys, mnemonicFromEntropy } from '../../../secret';
import { EAddressEncodings, type ICurveName } from '../../../types';
import {
  getAddressFromXpub,
  getBitcoinBip32,
  getBitcoinECPair,
  getBtcForkNetwork,
} from '../../btc/sdkBtc';

export const generateNativeSegwitAccounts = async ({
  curve,
  indexes,
  hdCredential,
  password,
  isTestnet,
}: {
  curve: ICurveName;
  indexes: number[];
  hdCredential: string;
  password: string;
  isTestnet: boolean;
}) => {
  const pathPrefix = `m/84'/0'`;
  const relPaths: string[] = indexes.map(
    (index) => `${index.toString()}'`, // btc
  );

  const pubkeyInfos = batchGetPublicKeys(
    curve,
    hdCredential,
    password,
    pathPrefix, // m/84'/0'
    relPaths, // 0'   1'
  );

  if (pubkeyInfos.length !== indexes.length) {
    throw new OneKeyInternalError('Unable to get publick key.');
  }

  const networkChainCode = isTestnet ? IMPL_TBTC : IMPL_BTC;
  const network = getBtcForkNetwork(networkChainCode);

  const { public: xpubVersionBytes } =
    ((network.segwitVersionBytes || {})[
      EAddressEncodings.P2WPKH
    ] as typeof network.bip32) || network.bip32;

  const mnemonic = mnemonicFromEntropy(hdCredential, password);
  const root = getBitcoinBip32().fromSeed(mnemonicToSeedSync(mnemonic));
  const xpubBuffers = [
    Buffer.from(xpubVersionBytes.toString(16).padStart(8, '0'), 'hex'),
    Buffer.from([3]),
  ];

  const addresses = await Promise.all(
    pubkeyInfos.map(async (info, index) => {
      const { path, parentFingerPrint, extendedKey } = info;

      const node = root.derivePath(`${path}/0/0`);
      const keyPair = getBitcoinECPair().fromWIF(node.toWIF());
      const publicKey = keyPair.publicKey.toString('hex');

      const xpub = bs58check.encode(
        Buffer.concat([
          ...xpubBuffers,
          parentFingerPrint,
          Buffer.from(
            (indexes[index] + 2 ** 31).toString(16).padStart(8, '0'),
            'hex',
          ),
          extendedKey.chainCode,
          extendedKey.key,
        ]),
      );

      const firstAddressRelPath = '0/0';
      const relativePaths = [firstAddressRelPath];
      const { [firstAddressRelPath]: address } = getAddressFromXpub({
        curve,
        network,
        xpub,
        relativePaths,
        addressEncoding: EAddressEncodings.P2WPKH,
        encodeAddress: (r) => r,
      });

      const accountIndex = indexes[index];
      const addressItem = {
        accountIndex,
        address,
        publicKey,
        path,
        relPath: firstAddressRelPath,
        xpub,
      };
      return addressItem;
    }),
  );
  return addresses;
};
