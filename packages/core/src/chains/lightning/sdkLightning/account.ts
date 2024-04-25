import bs58check from 'bs58check';

import {
  COINTYPE_BTC,
  COINTYPE_TBTC,
  IMPL_BTC,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';

import { batchGetPublicKeys } from '../../../secret';
import { EAddressEncodings, type ICurveName } from '../../../types';
import { getAddressFromXpub, getBtcForkNetwork } from '../../btc/sdkBtc';

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
  const pathPrefix = `m/84'/${isTestnet ? COINTYPE_TBTC : COINTYPE_BTC}'`;
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
  const xpubBuffers = [
    Buffer.from(xpubVersionBytes.toString(16).padStart(8, '0'), 'hex'),
    Buffer.from([3]),
  ];

  const addresses = await Promise.all(
    pubkeyInfos.map(async (info, index) => {
      const { path, parentFingerPrint, extendedKey } = info;
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
      const { addresses: generatedAddresses } = await getAddressFromXpub({
        curve,
        network,
        xpub,
        relativePaths,
        addressEncoding: EAddressEncodings.P2WPKH,
        encodeAddress: (r) => r,
      });

      const { [firstAddressRelPath]: address } = generatedAddresses;

      const accountIndex = indexes[index];
      const addressItem = {
        accountIndex,
        address,
        publicKey: xpub,
        path,
        relPath: firstAddressRelPath,
      };
      return addressItem;
    }),
  );
  return addresses;
};
