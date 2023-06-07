import { hexZeroPad, splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { serialize } from '@ethersproject/transactions';

import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import { batchGetPublicKeys } from '@onekeyhq/engine/src/secret';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import { OneKeyInternalError } from '../../../../errors';
import {
  getAccountNameInfoByImpl,
  getAccountNameInfoByTemplate,
} from '../../../../managers/impl';
import { Signer, Verifier } from '../../../../proxy';
import { AccountType } from '../../../../types/account';
import { KeyringHdBase } from '../../../keyring/KeyringHdBase';
import { buildEtherUnSignedTx, pubkeyToAddress } from '../utils';

import type { ExportedSeedCredential } from '../../../../dbs/base';
import type {
  DBSimpleAccount,
  DBVariantAccount,
} from '../../../../types/account';
import type { SignedTx, UnsignedTx } from '../../../../types/provider';
import type {
  IPrepareSoftwareAccountsParams,
  ISignCredentialOptions,
} from '../../../types';

type Curve = 'secp256k1' | 'ed25519';

export class KeyringHd extends KeyringHdBase {
  async getVerifier(pub: string): Promise<Verifier> {
    const provider =
      await this.vault.engine.providerManager.getChainInfoByNetworkId(
        this.networkId,
      );
    if (typeof provider === 'undefined') {
      throw new OneKeyInternalError('Provider not found.');
    }

    return new Verifier(pub, provider.curve as Curve);
  }

  override async getSigners(password: string, addresses: Array<string>) {
    const dbAccount = await this.getDbAccount();

    if (addresses.length !== 1) {
      throw new OneKeyInternalError('EVM signers number should be 1.');
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
    const { password, indexes, names, coinType, template } = params;
    const { seed } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const { pathPrefix, pathSuffix } = slicePathTemplate(template);

    const pubkeyInfos = batchGetPublicKeys(
      'secp256k1',
      seed,
      password,
      pathPrefix,
      indexes.map((index) => pathSuffix.replace('{index}', index.toString())),
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    const impl = await this.getNetworkImpl();
    const { prefix } = getAccountNameInfoByTemplate(impl, template);
    for (const info of pubkeyInfos) {
      const {
        path,
        extendedKey: { key: pubkey },
      } = info;
      const pub = pubkey.toString('hex');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const address: string = await pubkeyToAddress(
        await this.getVerifier(pub),
      );
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      const isLedgerLiveTemplate =
        getAccountNameInfoByImpl(impl).ledgerLive.template === template;
      ret.push({
        id: isLedgerLiveTemplate
          ? // because the first account path of ledger live template is the same as the bip44 account path
            `${this.walletId}--${path}--LedgerLive`
          : `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType,
        pub,
        address,
        template,
      });
      index += 1;
    }
    return ret;
  }

  override async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const chainId = await this.vault.getNetworkChainId();
    const fromAddress = unsignedTx.inputs[0]?.address;
    const signers = await this.getSigners(
      options.password || '',
      unsignedTx.inputs.map((input) => input.address),
    );
    check(fromAddress && signers[fromAddress], 'Signer not found');
    const tx = buildEtherUnSignedTx(unsignedTx, chainId);
    const digest = keccak256(serialize(tx));
    const [sig, recoveryParam] = await signers[fromAddress].sign(
      Buffer.from(digest.slice(2), 'hex'),
    );
    const [r, s]: [Buffer, Buffer] = [sig.slice(0, 32), sig.slice(32)];
    const signature = splitSignature({
      recoveryParam,
      r: hexZeroPad(`0x${r.toString('hex')}`, 32),
      s: hexZeroPad(`0x${s.toString('hex')}`, 32),
    });

    const rawTx: string = serialize(tx, signature);
    const txid = keccak256(rawTx);
    return { txid, rawTx };
  }
}
