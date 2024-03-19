import bs58check from 'bs58check';
import { omit } from 'lodash';

import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import { KeyringImported as KeyringImportedBtcFork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/KeyringImported';

import { OneKeyInternalError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { AddressEncodings } from '../../utils/btcForkChain/types';
import {
  getBip32FromBase58,
  initBitcoinEcc,
} from '../../utils/btcForkChain/utils';

import type { DBUTXOAccount } from '../../../types/account';
import type { IPrepareImportedAccountsParams } from '../../types';
import type BTCForkVault from '../../utils/btcForkChain/VaultBtcFork';

export class KeyringImported extends KeyringImportedBtcFork {
  override async prepareAccounts(
    params: IPrepareImportedAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    initBitcoinEcc();
    const { privateKey, name, template } = params;
    const provider = await (
      this.vault as unknown as BTCForkVault
    ).getProvider();
    const COIN_TYPE = (this.vault as unknown as BTCForkVault).getCoinType();

    let xpub = '';
    let pub = '';
    const privateKeyString = bs58check.encode(privateKey);

    const { network } = provider;
    const xprvVersionBytesNum = parseInt(
      privateKey.slice(0, 4).toString('hex'),
      16,
    );
    const versionByteOptions = [
      ...Object.values(omit(network.segwitVersionBytes, AddressEncodings.P2TR)),
      network.bip32,
    ];
    for (const versionBytes of versionByteOptions) {
      if (versionBytes.private === xprvVersionBytesNum) {
        const publicKey = secp256k1.publicFromPrivate(privateKey.slice(46, 78));
        const pubVersionBytes = Buffer.from(
          versionBytes.public.toString(16).padStart(8, '0'),
          'hex',
        );
        try {
          xpub = bs58check.encode(
            privateKey.fill(pubVersionBytes, 0, 4).fill(publicKey, 45, 78),
          );
        } catch (e) {
          console.error(e);
        }
      }
    }
    if (xpub === '') {
      throw new OneKeyInternalError('Invalid private key.');
    }

    let addressEncoding;
    let xpubSegwit = xpub;
    if (template) {
      if (template.startsWith(`m/44'/`)) {
        addressEncoding = AddressEncodings.P2PKH;
      } else if (template.startsWith(`m/86'/`)) {
        addressEncoding = AddressEncodings.P2TR;
        xpubSegwit = `tr(${xpub})`;
      } else {
        addressEncoding = undefined;
      }
    }

    const firstAddressRelPath = '0/0';
    const { [firstAddressRelPath]: address } = provider.xpubToAddresses(
      xpub,
      [firstAddressRelPath],
      addressEncoding,
    );

    const node = getBip32FromBase58({
      coinType: COIN_TYPE,
      key: privateKeyString,
    }).derivePath(firstAddressRelPath);

    pub = node.publicKey.toString('hex');
    return Promise.resolve([
      {
        id: `imported--${COIN_TYPE}--${xpub}--${
          addressEncoding === AddressEncodings.P2TR ? `86'/` : ''
        }`,
        name: name || '',
        type: AccountType.UTXO,
        path: '',
        coinType: COIN_TYPE,
        pub,
        xpub,
        xpubSegwit,
        address,
        addresses: { [firstAddressRelPath]: address },
        template,
      },
    ]);
  }
}
