import type {
  ICoreApiNetworkInfo,
  ICoreCredentialsInfo,
  ICoreHdCredential,
  ICoreImportedCredential,
} from '@onekeyhq/core/src/types';
import { wait } from '@onekeyhq/kit/src/utils/helper';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  getAccountNameInfoByImpl,
  getAccountNameInfoByTemplate,
} from '../../managers/impl';
import { AccountType } from '../../types/account';
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
import type { ICurveName } from '../../secret';
import type {
  DBAccount,
  DBSimpleAccount,
  DBUTXOAccount,
  DBVariantAccount,
} from '../../types/account';
import type { IUnsignedMessage } from '../../types/message';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  IPrepareImportedAccountsParams,
} from '../types';
import type { AddressEncodings } from '../utils/btcForkChain/types';

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

    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const result = await this.coreApi.signTransaction({
      networkInfo,
      unsignedTx,
      account: dbAccount,
      password,
      credentials,
    });
    return result;
  }

  async baseSignMessage(
    messages: IUnsignedMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { password } = options;
    const dbAccount = await this.getDbAccount();

    const credentials = await this.baseGetCredentialsInfo(options);
    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const result = await Promise.all(
      messages.map((msg) =>
        checkIsDefined(this.coreApi).signMessage({
          networkInfo,
          unsignedMsg: msg,
          account: dbAccount,
          password,
          credentials,
        }),
      ),
    );
    return result;
  }

  async baseGetPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    const { password, relPaths } = params;
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const dbAccount = await this.getDbAccount();
    const credentials = await this.baseGetCredentialsInfo({ password });
    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const privateKeys = await this.coreApi.getPrivateKeys({
      networkInfo,
      password,
      account: { ...dbAccount, relPaths },
      credentials,
    });
    const result: IGetPrivateKeysResult = {};
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
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { name, privateKey } = params;
    const { coinType, accountType } = options;

    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const privateKeyRaw = bufferUtils.bytesToHex(privateKey);
    const { address, addresses, publicKey } =
      await this.coreApi.getAddressFromPrivate({
        networkInfo,
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
        addresses,
      },
    ]);
  }

  async baseGetCoreApiNetworkInfo(): Promise<ICoreApiNetworkInfo> {
    const network = await this.getNetwork();
    const chainInfo = await this.getChainInfo();
    const addressPrefix = chainInfo?.implOptions?.addressPrefix as
      | string
      | undefined;
    const curve = chainInfo?.implOptions?.curve as ICurveName | undefined;
    const chainCode = chainInfo.code;
    const chainId = await this.vault.getNetworkChainId();
    const networkImpl = await this.getNetworkImpl();
    const { isTestnet } = network;
    const { networkId } = this;
    return {
      isTestnet,
      networkChainCode: chainCode,
      chainId,
      networkId,
      networkImpl,
      addressPrefix,
      curve,
    };
  }

  async basePrepareAccountsHd(
    params: IPrepareHdAccountsParams,
    options: {
      accountType: AccountType;
      usedIndexes: number[];
    },
  ): Promise<Array<DBSimpleAccount | DBVariantAccount>> {
    if (!this.coreApi) {
      throw new Error('coreApi is not defined');
    }
    const { password, names, coinType, template } = params;
    if (!coinType) {
      throw new Error('coinType is not defined');
    }
    const { accountType, usedIndexes } = options;

    const networkInfo = await this.baseGetCoreApiNetworkInfo();

    const credentials = await this.baseGetCredentialsInfo({ password });
    const { addresses: addressInfos } = await this.coreApi.getAddressesFromHd({
      networkInfo,
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

    const ret: Array<DBSimpleAccount | DBVariantAccount> = [];
    for (let index = 0; index < addressInfos.length; index += 1) {
      const { path, publicKey, address, addresses } = addressInfos[index];
      if (!path) {
        throw new Error('KeyringHD prepareAccounts ERROR: path not found');
      }
      if (accountType === AccountType.VARIANT && !addresses) {
        throw new Error('addresses is required for variant account');
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
        addresses,
        template,
      });
    }

    return ret;
  }

  async basePrepareAccountsHdUtxo(
    params: IPrepareHdAccountsParams,
    options: {
      addressEncoding?: AddressEncodings;
      checkIsAccountUsed: (query: {
        xpub: string;
        xpubSegwit?: string;
        address: string;
      }) => Promise<{ isUsed: boolean }>;
    },
  ): Promise<DBUTXOAccount[]> {
    if (!this.coreApi) {
      throw new Error('coreApi is undefined');
    }
    const {
      password,
      indexes,
      coinType,
      purpose,
      names,
      template,
      skipCheckAccountExist,
    } = params;
    if (!coinType) {
      throw new Error('coinType is not defined');
    }
    const { addressEncoding, checkIsAccountUsed } = options;
    const impl = await this.getNetworkImpl();

    const ignoreFirst = indexes[0] !== 0;
    // check first prev non-zero index account existing
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];

    const credentials = await this.baseGetCredentialsInfo({ password });
    const { addresses: addressesInfo } = await this.coreApi.getAddressesFromHd({
      networkInfo: await this.baseGetCoreApiNetworkInfo(),
      template,
      hdCredential: checkIsDefined(credentials.hd),
      password,
      indexes: usedIndexes,
      addressEncoding,
    });

    if (addressesInfo.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get address');
    }

    const { prefix: namePrefix } = getAccountNameInfoByTemplate(impl, template);

    const ret: DBUTXOAccount[] = [];
    let index = 0;
    for (const {
      path,
      publicKey,
      xpub,
      xpubSegwit,
      address,
      addresses,
    } of addressesInfo) {
      if (!path || !xpub || !addresses) {
        throw new Error('path or xpub or addresses is undefined');
      }

      const prefix = namePrefix;
      const name = names?.[index] || `${prefix} #${usedIndexes[index] + 1}`;
      const id = `${this.walletId}--${path}`;
      if (!ignoreFirst || index > 0) {
        ret.push({
          id,
          name,
          type: AccountType.UTXO,
          path,
          coinType,
          pubKey: publicKey,
          xpub,
          xpubSegwit,
          address,
          addresses,
          template,
        });
      }

      const isLast = index === addressesInfo.length - 1;
      if (!skipCheckAccountExist && !isLast) {
        const { isUsed } = await checkIsAccountUsed({
          xpub,
          xpubSegwit,
          address,
        });
        if (!isUsed) {
          // Software should prevent a creation of an account
          // if a previous account does not have a transaction history (meaning none of its addresses have been used before).
          // https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
          break;
        }
        // blockbook API rate limit.
        await wait(200);
      }

      index += 1;
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

  // TODO remove, move to core api
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
