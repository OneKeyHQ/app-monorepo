import type {
  ICoreCredentialsInfo,
  ICoreHdCredential,
  ICoreImportedCredential,
  ICoreUnsignedMessage,
} from '@onekeyhq/core/src/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  getAccountNameInfoByImpl,
  getAccountNameInfoByTemplate,
} from '../../managers/impl';
import {
  type IPrepareAccountByAddressIndexParams,
  type ISignCredentialOptions,
  type ISignedTxPro,
  type IUnsignedTxPro,
} from '../types';

import { KeyringBase } from './KeyringBase';

import type {
  ExportedPrivateKeyCredential,
  ExportedSeedCredential,
} from '../../dbs/base';
import type { ChainSigner } from '../../proxy';
import type {
  AccountType,
  DBAccount,
  DBSimpleAccount,
} from '../../types/account';
import type {
  IPrepareHdAccountsParams,
  IPrepareImportedAccountsParams,
} from '../types';
import type VaultBtcFork from '../utils/btcForkChain/VaultBtcFork';

export abstract class KeyringSoftwareBase extends KeyringBase {
  async baseGetCredentialsInfo({
    password,
  }: ISignCredentialOptions): Promise<ICoreCredentialsInfo> {
    let hd: ICoreHdCredential | undefined;
    let imported: ICoreImportedCredential | undefined;

    // hd
    if (this.isKeyringHd()) {
      const credential = (await this.engine.dbApi.getCredential(
        this.walletId,
        password,
      )) as ExportedSeedCredential;
      hd = {
        seed: bufferUtils.bytesToHex(credential.seed),
        entropy: bufferUtils.bytesToHex(credential.entropy),
      };
    }

    // imported
    if (this.isKeyringImported()) {
      const credential = (await this.engine.dbApi.getCredential(
        this.accountId,
        password,
      )) as ExportedPrivateKeyCredential;
      imported = {
        privateKey: bufferUtils.bytesToHex(credential.privateKey),
      };
    }

    return {
      hd,
      imported,
    };
  }

  async baseSignTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { password } = options;
    const dbAccount = await this.getDbAccount();

    const credentials = await this.baseGetCredentialsInfo(options);

    const result = await this.coreApi.signTransaction({
      unsignedTx,
      account: dbAccount,
      password,
      credentials,
    });
    return result;
  }

  async baseSignMessage(
    messages: ICoreUnsignedMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { password } = options;
    const dbAccount = await this.getDbAccount();

    const credentials = await this.baseGetCredentialsInfo(options);

    const result = await Promise.all(
      messages.map((msg) =>
        checkIsDefined(this.coreApi).signMessage({
          unsignedMsg: msg,
          account: dbAccount,
          password,
          credentials,
        }),
      ),
    );
    return result;
  }

  async baseGetPrivateKeys({
    password,
    relPaths,
  }: {
    password: string;
    relPaths?: string[] | undefined;
  }): Promise<Record<string, Buffer>> {
    const dbAccount = await this.getDbAccount();
    const credentials = await this.baseGetCredentialsInfo({ password });
    const privateKeys = await checkIsDefined(this.coreApi).getPrivateKeys({
      password,
      account: { ...dbAccount, relPaths },
      credentials,
    });
    const result: Record<string, Buffer> = {};
    Object.entries(privateKeys).forEach(([path, privateKey]) => {
      result[path] = bufferUtils.toBuffer(privateKey);
    }, {});
    return result;
  }

  async basePrepareAccountsImported(
    params: IPrepareImportedAccountsParams,
    options: {
      coinType: string;
      accountType: AccountType;
    },
  ): Promise<Array<DBSimpleAccount>> {
    const { name, privateKey } = params;
    const { coinType, accountType } = options;

    const privateKeyRaw = bufferUtils.bytesToHex(privateKey);
    const { address, publicKey } = await checkIsDefined(
      this.coreApi,
    ).getAddressFromPrivate({
      privateKeyRaw,
    });

    return Promise.resolve([
      {
        id: `imported--${coinType}--${publicKey}`,
        name: name || '',
        type: accountType,
        path: '',
        coinType,
        pub: publicKey,
        address,
      },
    ]);
  }

  async basePrepareAccountsHd(
    params: IPrepareHdAccountsParams,
    options: {
      accountType: AccountType;
      usedIndexes: number[];
    },
  ): Promise<Array<DBSimpleAccount>> {
    const { password, names, coinType, template } = params;
    const { accountType, usedIndexes } = options;

    const chainCode = (await this.getChainInfo()).code;
    const credentials = await this.baseGetCredentialsInfo({ password });
    const { addresses: addressInfos } = await checkIsDefined(
      this.coreApi,
    ).getAddressesFromHd({
      networkChainCode: chainCode,
      template,
      hdCredential: checkIsDefined(credentials.hd),
      password,
      indexes: usedIndexes,
    });

    const impl = await this.getNetworkImpl();
    const { prefix: namePrefix } = getAccountNameInfoByTemplate(impl, template);
    const isLedgerLiveTemplate =
      impl === IMPL_EVM &&
      getAccountNameInfoByImpl(impl)?.ledgerLive?.template === template;

    const ret: DBSimpleAccount[] = [];
    for (let index = 0; index < addressInfos.length; index += 1) {
      const { path, publicKey, address } = addressInfos[index];
      if (!path) {
        throw new Error('KeyringHD prepareAccounts ERROR: path not found');
      }

      const name = names?.[index] || `${namePrefix} #${usedIndexes[index] + 1}`;

      let id = `${this.walletId}--${path}`;
      if (isLedgerLiveTemplate) {
        // because the first account path of ledger live template is the same as the bip44 account path
        id = `${this.walletId}--${path}--LedgerLive`;
      }

      ret.push({
        id,
        name,
        type: accountType,
        path,
        coinType,
        pub: publicKey,
        address,
        template,
      });
    }

    return ret;
  }

  // Implemented by HD & imported base.
  abstract getPrivateKeys({
    password,
    relPaths,
  }: {
    password: string;
    relPaths?: Array<string>;
  }): Promise<Record<string, Buffer>>; // full path to private key

  // TODO remove
  // Implemented by different implementations, use getPrivateKeys to build signers.
  abstract getSigners(
    password: string,
    addresses: Array<string>,
  ): Promise<Record<string, ChainSigner>>;

  // TODO import type { Signer } from '../../proxy';

  // TODO: check history is added
  async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    const { password } = options;
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }
    const signers = await this.getSigners(
      password,
      unsignedTx.inputs.map((input) => input.address),
    );
    debugLogger.engine.info('signTransaction', this.networkId, unsignedTx);
    const signedTx = await this.engine.providerManager.signTransaction(
      this.networkId,
      unsignedTx,
      signers,
    );
    return {
      ...signedTx,
      encodedTx: unsignedTx.encodedTx,
    };
  }

  // TODO: check history is added
  async signMessage(
    messages: any[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const { password } = options;
    if (typeof password === 'undefined') {
      throw new OneKeyInternalError('Software signing requires a password.');
    }
    const dbAccount = await this.getDbAccount();
    const [signer] = Object.values(
      await this.getSigners(password, [dbAccount.address]),
    );
    debugLogger.engine.info('signMessage', this.networkId, messages);
    return Promise.all(
      messages.map((message) =>
        this.engine.providerManager.signMessage(
          this.networkId,
          message,
          signer,
        ),
      ),
    );
  }

  override getAddress(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override batchGetAddress(): Promise<{ path: string; address: string }[]> {
    throw new Error('Method not implemented.');
  }

  override prepareAccountByAddressIndex(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: IPrepareAccountByAddressIndexParams,
  ): Promise<DBAccount[]> {
    throw new Error('Method not implemented.');
  }
}
