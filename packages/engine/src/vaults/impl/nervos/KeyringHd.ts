import { blockchain } from '@ckb-lumos/base';
import { sealTransaction } from '@ckb-lumos/helpers';
import { bytesToHex } from '@noble/hashes/utils';

import type { ExportedSeedCredential } from '@onekeyhq/engine/src/dbs/base';
import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';
import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import { getAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import { Signer } from '@onekeyhq/engine/src/proxy';
import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import { AccountType } from '@onekeyhq/engine/src/types/account';
import type { UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import {
  addHexPrefix,
  stripHexPrefix,
} from '@onekeyhq/engine/src/vaults/utils/hexUtils';
import {
  IMPL_NERVOS as COIN_IMPL,
  COINTYPE_NERVOS as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { KeyringHdBase } from '../../keyring/KeyringHdBase';

import { pubkeyToAddress } from './utils/address';
import { getConfig } from './utils/config';
import {
  convertEncodeTxNervosToSkeleton,
  fillSkeletonWitnessesWithAccount,
  serializeTransactionMessage,
} from './utils/transaction';

import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
  SignedTxResult,
} from '../../types';

// @ts-ignore
export class KeyringHd extends KeyringHdBase {
  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('Nervos signers number should be 1.');
    } else if (addresses[0] !== dbAccount.address) {
      throw new OneKeyInternalError('Wrong address required for signing.');
    }

    const { [dbAccount.path]: privateKey } = await this.getPrivateKeys(
      password,
    );
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Unable to get signer.');
    }

    return {
      [dbAccount.address]: new Signer(privateKey, password, 'secp256k1'),
    };
  }

  override async prepareAccounts(
    params: IPrepareSoftwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { password, indexes, names, template } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const { pathPrefix } = slicePathTemplate(template);
    const pubKeyInfos = batchGetPublicKeys(
      'secp256k1',
      seed,
      password,
      pathPrefix,
      indexes.map((index) => `${index.toString()}`),
    );

    if (pubKeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }
    const chainId = await this.getNetworkChainId();
    const config = getConfig(chainId);

    const { prefix } = getAccountNameInfoByImpl(COIN_IMPL).default;

    const ret = [];
    let index = 0;
    for (const info of pubKeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;

      const pubkeyHex = bytesToHex(pubkey);
      const address = pubkeyToAddress(addHexPrefix(pubkeyHex), { config });
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: pubkeyHex,
        address,
      });
      index += 1;
    }
    return ret;
  }

  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTxResult> {
    debugLogger.common.info('signTransaction result', unsignedTx);
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const sender = dbAccount.address;
    const signers = await this.getSigners(options.password || '', [sender]);
    const signer = signers[sender];

    const chainId = await this.getNetworkChainId();
    const { encodedTx } = unsignedTx.payload;
    let txSkeleton = convertEncodeTxNervosToSkeleton({
      encodedTxNervos: encodedTx,
      config: getConfig(chainId),
    });
    txSkeleton = fillSkeletonWitnessesWithAccount({
      sendAccount: sender,
      txSkeleton,
      config: getConfig(chainId),
    });
    const { txSkeleton: txSkeletonWithMessage, message } =
      serializeTransactionMessage(txSkeleton);

    if (!message) {
      throw new OneKeyInternalError('Unable to serialize transaction message.');
    }

    const [signature, recoveryParam] = await signer.sign(
      Buffer.from(stripHexPrefix(message), 'hex'),
    );
    const recoveryParamHex = recoveryParam.toString(16).padStart(2, '0');
    const sig = addHexPrefix(bytesToHex(signature) + recoveryParamHex);

    const tx = sealTransaction(txSkeletonWithMessage, [sig]);
    const signedTx = blockchain.Transaction.pack(tx);

    return {
      txid: '',
      rawTx: bytesToHex(signedTx),
    };
  }
}
