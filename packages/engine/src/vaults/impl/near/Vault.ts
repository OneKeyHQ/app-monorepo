/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, camelcase, @typescript-eslint/naming-convention */
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { last } from 'lodash';
import memoizee from 'memoizee';

import { ed25519 } from '@onekeyhq/engine/src/secret/curves';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type { PartialTokenInfo } from '@onekeyhq/engine/src/types/provider';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  InvalidAddress,
  OneKeyInternalError,
  WatchedAccountTradeError,
} from '../../../errors';
import { extractResponseError } from '../../../proxy';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import {
  KeyringHardware,
  KeyringHd,
  KeyringImported,
  KeyringWatching,
} from './keyring';
import { NearCli } from './sdk';
import settings from './settings';
import {
  BN,
  FT_MINIMUM_STORAGE_BALANCE_LARGE,
  FT_STORAGE_DEPOSIT_GAS,
  FT_TRANSFER_DEPOSIT,
  FT_TRANSFER_GAS,
  baseDecode,
  baseEncode,
  decodedTxToLegacy,
  deserializeTransaction,
  nearApiJs,
  parseJsonFromRawResponse,
  serializeTransaction,
  verifyNearAddress,
} from './utils';

import type { DBVariantAccount } from '../../../types/account';
import type { Token } from '../../../types/token';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { INearAccountStorageBalance, NearAccessKey } from './types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

// TODO extends evm/Vault
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  // client: axios
  helperApi = axios.create({
    // TODO testnet, mainnet in config
    baseURL: 'https://helper.mainnet.near.org',
    // timeout: 30 * 1000,
    headers: {
      'X-Custom-Header': 'foobar',
      'Content-Encoding': 'gzip',
      'Content-Type': 'application/json',
    },
  });

  _createNearCli = memoizee(
    async (rpcUrl: string, networkId: string) => {
      // TODO add timeout params
      // TODO replace in ProviderController.getClient()
      // client: cross-fetch
      const nearCli = new NearCli(`${rpcUrl}`);
      const chainInfo =
        await this.engine.providerManager.getChainInfoByNetworkId(networkId);
      // TODO move to base, setChainInfo like what ProviderController.getClient() do
      nearCli.setChainInfo(chainInfo);
      // nearCli.rpc.timeout = 60 * 1000;

      return nearCli;
    },
    {
      promise: true,
      primitive: true,
      normalizer(
        args: Parameters<
          (rpcUrl: string, networkId: string) => Promise<NearCli>
        >,
      ): string {
        return `${args[0]}:${args[1]}`;
      },
      max: 1,
      maxAge: 1000 * 60 * 15,
    },
  );

  // TODO rename to prop get client();
  async _getNearCli(): Promise<NearCli> {
    const { rpcURL } = await this.getNetwork();
    const nearCli = await this._createNearCli(rpcURL, this.networkId);
    return nearCli;
  }

  async _getPublicKey({
    encoding = 'base58',
    prefix = true,
  }: {
    encoding?: 'hex' | 'base58' | 'buffer';
    prefix?: boolean;
  } = {}): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;

    const pub = // Before commit a7430c1038763d8d7f51e7ddfe1284e3e0bcc87c, pubkey was stored
      // in hexstring, afterwards it is stored using encoded format.
      dbAccount.pub.startsWith('ed25519:')
        ? baseDecode(dbAccount.pub.split(':')[1]).toString('hex')
        : dbAccount.pub;
    const verifier = this.engine.providerManager.getVerifier(
      this.networkId,
      pub,
    );
    const pubKeyBuffer = await verifier.getPubkey(true);

    if (encoding === 'buffer') {
      // return pubKeyBuffer;
    }
    if (encoding === 'base58') {
      const prefixStr = prefix ? 'ed25519:' : '';
      return prefixStr + baseEncode(pubKeyBuffer);
    }
    if (encoding === 'hex') {
      return pubKeyBuffer.toString('hex');
    }
    // if (encoding === 'object') {
    // return nearApiJs.utils.key_pair.PublicKey.from(pubKeyBuffer);
    // }
    return '';
  }

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    const cli = await this._getNearCli();
    try {
      return await cli.rpc.call(
        request.method,
        request.params as Record<string, any> | Array<any>,
      );
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  attachFeeInfoToEncodedTx(params: {
    encodedTx: any;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<any> {
    return Promise.resolve(params.encodedTx);
  }

  async nativeTxActionToEncodedTxAction(
    nativeTx: nearApiJs.transactions.Transaction,
  ) {
    const address = await this.getAccountAddress();
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);

    const actions = await Promise.all(
      nativeTx.actions.map(async (nativeAction) => {
        const action: IDecodedTxAction = {
          type: IDecodedTxActionType.UNKNOWN,
          direction: IDecodedTxDirection.SELF,
          unknownAction: {
            // TODO other actions parse
            // extraInfo: JSON.stringify(nativeAction),
            extraInfo: null,
          },
        };
        if (nativeAction.enum === 'transfer') {
          action.type = IDecodedTxActionType.NATIVE_TRANSFER;

          const amountValue = nativeAction.transfer.deposit.toString();
          const amount = new BigNumber(amountValue)
            .shiftedBy(nativeToken.decimals * -1)
            .toFixed();
          action.nativeTransfer = {
            tokenInfo: nativeToken,
            from: nativeTx.signerId,
            to: nativeTx.receiverId,
            amount,
            amountValue,
            extraInfo: null,
          };
        }
        if (nativeAction.enum === 'functionCall') {
          // TODO functionCall action type support
          if (nativeAction?.functionCall?.methodName === 'ft_transfer') {
            action.type = IDecodedTxActionType.TOKEN_TRANSFER;
            const tokenInfo = await this.engine.ensureTokenInDB(
              this.networkId,
              nativeTx.receiverId,
            );
            if (tokenInfo) {
              const transferData = parseJsonFromRawResponse(
                nativeAction.functionCall?.args,
              ) as {
                receiver_id: string;
                sender_id: string;
                amount: string;
              };
              const amountValue = transferData.amount;
              const amount = new BigNumber(amountValue)
                .shiftedBy(tokenInfo.decimals * -1)
                .toFixed();
              action.tokenTransfer = {
                tokenInfo,
                from: transferData.sender_id || nativeTx.signerId,
                to: transferData.receiver_id,
                amount,
                amountValue,
                extraInfo: null,
              };
            }
          }
        }
        return action;
      }),
    );
    return actions;
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve(decodedTxToLegacy(decodedTx));
  }

  async decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx> {
    const nativeTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as nearApiJs.transactions.Transaction;
    const decodedTx: IDecodedTx = {
      txid: '',
      owner: await this.getAccountAddress(),
      signer: nativeTx.signerId,
      nonce: parseFloat(nativeTx.nonce.toString()),
      actions: await this.nativeTxActionToEncodedTxAction(nativeTx),

      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
    };

    return decodedTx;
  }

  async _buildStorageDepositAction({
    amount,
    address,
  }: {
    amount: BN;
    address: string;
  }) {
    return nearApiJs.transactions.functionCall(
      'storage_deposit',
      {
        account_id: address,
        registration_only: true,
      },
      new BN(FT_STORAGE_DEPOSIT_GAS ?? '0'),
      amount,
    );
  }

  async _buildNativeTokenTransferAction({
    amount,
  }: IEncodedTxUpdatePayloadTransfer) {
    const network = await this.getNetwork();
    const amountBN = new BigNumber(amount || 0);
    const amountBNInAction = new BN(
      amountBN.shiftedBy(network.decimals).toFixed(),
    );
    return nearApiJs.transactions.transfer(amountBNInAction);
  }

  async _buildTokenTransferAction({
    transferInfo,
    token,
  }: {
    transferInfo: ITransferInfo;
    token: Token;
  }) {
    // TODO check if receipt address activation, and create an activation action
    const amountBN = new BigNumber(transferInfo.amount || 0);
    const amountStr = amountBN.shiftedBy(token.decimals).toFixed();
    return nearApiJs.transactions.functionCall(
      'ft_transfer',
      {
        amount: amountStr,
        receiver_id: transferInfo.to,
      },
      new BN(FT_TRANSFER_GAS),
      new BN(FT_TRANSFER_DEPOSIT),
    );
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<string> {
    // TODO check dbAccount address match transferInfo.from
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;

    if (!dbAccount.pub && dbAccount.id.startsWith('watching--')) {
      throw new WatchedAccountTradeError();
    }

    const actions = [];

    // token transfer
    if (transferInfo.token) {
      // TODO transferInfo.from and transferInfo.to cannot be the same
      // TODO pass token from ITransferInfo
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        transferInfo.token ?? '',
      );
      if (token) {
        const hasStorageBalance = await this.isStorageBalanceAvailable({
          address: transferInfo.to,
          tokenAddress: transferInfo.token,
        });
        if (!hasStorageBalance) {
          // action: storage_deposit
          actions.push(
            await this._buildStorageDepositAction({
              // amount: new BN(FT_MINIMUM_STORAGE_BALANCE ?? '0'), // TODO small storage deposit
              amount: new BN(FT_MINIMUM_STORAGE_BALANCE_LARGE ?? '0'),
              address: transferInfo.to,
            }),
          );
        }
        // action: token transfer
        actions.push(
          await this._buildTokenTransferAction({
            transferInfo,
            token,
          }),
        );
      }
    } else {
      // action: native token transfer
      actions.push(
        await this._buildNativeTokenTransferAction({
          amount: transferInfo.amount,
        }),
      );
    }
    const pubKey = await this._getPublicKey({ prefix: false });
    const publicKey = nearApiJs.utils.key_pair.PublicKey.from(pubKey);
    // TODO Mock value here, update nonce and blockHash in buildUnsignedTxFromEncodedTx later
    const nonce = 0; // 65899896000001
    const blockHash = '91737S76o1EfWfjxUQ4k3dyD3qmxDQ7hqgKUKxgxsSUW';
    const tx = nearApiJs.transactions.createTransaction(
      // 'c3be856133196da252d0f1083614cdc87a85c8aa8abeaf87daff1520355eec51',
      transferInfo.from,
      publicKey,
      transferInfo.token || transferInfo.to,
      nonce,
      actions,
      baseDecode(blockHash),
    );
    const txStr = serializeTransaction(tx);
    return Promise.resolve(txStr);
  }

  async buildUnsignedTxFromEncodedTx(encodedTx: any): Promise<IUnsignedTxPro> {
    const nativeTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as nearApiJs.transactions.Transaction;
    const cli = await this._getNearCli();

    // nonce is not correct if accounts contains multiple AccessKeys
    // const { nonce } = await cli.getAddress(nativeTx.signerId);
    const accessKey = await this.fetchAccountAccessKey();
    const { blockHash } = await cli.getBestBlock();

    nativeTx.nonce = accessKey?.nonce ?? 0;
    nativeTx.blockHash = baseDecode(blockHash);

    const unsignedTx: IUnsignedTxPro = {
      inputs: [],
      outputs: [],
      payload: {
        nativeTx,
      },
      encodedTx,
    };
    return unsignedTx;
  }

  // TODO max native transfer fee
  /*
  LackBalanceForState: {amount: "4644911012500000000000",…}
    amount: "4644911012500000000000"
    signer_id: "c3be856133196da252d0f1083614cdc87a85c8aa8abeaf87daff1520355eec53"
   */
  async fetchFeeInfo(encodedTx: any): Promise<IFeeInfo> {
    const cli = await this._getNearCli();
    const txCostConfig = await cli.getTxCostConfig();
    const priceInfo = await cli.getFeePricePerUnit();
    const network = await this.getNetwork();
    const price = priceInfo.normal.price.shiftedBy(-network.decimals).toFixed();
    const { transfer_cost, action_receipt_creation_config } = txCostConfig;
    let limit = '0';

    // hard to estimate gas of function call
    limit = new BigNumber(FT_TRANSFER_GAS).toFixed();

    const decodedTx = await this.decodeTx(encodedTx);
    const lastAction = last(decodedTx?.actions);
    if (lastAction && lastAction.type === IDecodedTxActionType.TOKEN_TRANSFER) {
      const info = lastAction.tokenTransfer;
      if (info) {
        const hasStorageBalance = await this.isStorageBalanceAvailable({
          address: info.to,
          tokenAddress: info.tokenInfo.tokenIdOnNetwork,
        });
        if (!hasStorageBalance) {
          // tokenTransfer with token activation
          limit = new BigNumber(transfer_cost.execution)
            .plus(action_receipt_creation_config.execution)
            .multipliedBy(2)
            .toFixed();
        }
      }
    }

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit,
      prices: [price],
      defaultPresetIndex: '0',

      tx: null, // Must be null if network not support feeInTx
    };
  }

  async updateEncodedTx(
    encodedTx: string,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<string> {
    const nativeTx = deserializeTransaction(encodedTx);
    // max native token transfer update
    if (options.type === 'transfer') {
      if (
        nativeTx?.actions?.length === 1 &&
        nativeTx?.actions[0]?.enum === 'transfer'
      ) {
        const payloadTransfer = payload as IEncodedTxUpdatePayloadTransfer;
        const action = await this._buildNativeTokenTransferAction(
          payloadTransfer,
        );
        nativeTx.actions = [action];
        return serializeTransaction(nativeTx);
      }
    }
    return Promise.resolve(encodedTx);
  }

  // ----------------------------------------------
  // TODO remove
  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new Error('Method not implemented: buildEncodedTxFromApprove');
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new Error('Method not implemented: updateEncodedTxTokenApprove');
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      const privateKey = decrypt(password, encryptedPrivateKey);
      const publicKey = ed25519.publicFromPrivate(privateKey);
      return `ed25519:${baseEncode(Buffer.concat([privateKey, publicKey]))}`;
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  isStorageBalanceAvailable = memoizee(
    async ({
      address,
      tokenAddress,
    }: {
      tokenAddress: string;
      address: string;
    }) => {
      const storageBalance = await this.fetchAccountStorageBalance({
        address,
        tokenAddress,
      });
      return storageBalance?.total !== undefined;
    },
    {
      promise: true,
      primitive: true,
      max: 1,
      maxAge: 1000 * 30,
      normalizer(
        args: Parameters<
          ({
            address,
            tokenAddress,
          }: {
            tokenAddress: string;
            address: string;
          }) => Promise<boolean>
        >,
      ): string {
        return JSON.stringify(args);
      },
    },
  );

  async fetchAccountStorageBalance({
    address,
    tokenAddress,
  }: {
    address: string;
    tokenAddress: string;
  }): Promise<INearAccountStorageBalance | null> {
    const cli = await this._getNearCli();
    const result = (await cli.callContract(tokenAddress, 'storage_balance_of', {
      account_id: address,
    })) as INearAccountStorageBalance;

    return result;
  }

  async fetchDomainAccountsFromPublicKey({ publicKey }: { publicKey: string }) {
    const res = await this.helperApi.get(`/publicKey/${publicKey}/accounts`);
    return res.data as string[];
  }

  async fetchDomainAccounts() {
    try {
      // find related domain account from NEAR first HD account
      const publicKey = await this._getPublicKey({
        encoding: 'base58',
        prefix: true,
      });
      const domainAddrs = await this.fetchDomainAccountsFromPublicKey({
        publicKey,
      });
      if (domainAddrs.length) {
        const domainAccounts = domainAddrs.map((addr) => ({
          address: addr,
          isDomainAccount: true,
        }));
        return domainAccounts;
      }
    } catch (error) {
      console.error(error);
    }

    return [];
  }

  async fetchAccountAccessKey(): Promise<NearAccessKey | undefined> {
    const cli = await this._getNearCli();
    const dbAccount = await this.getDbAccount();
    const result = (await cli.getAccessKeys(dbAccount.address)) || [];
    const publicKey = await this._getPublicKey();
    const info = result.find((item) => item.pubkey === publicKey);
    return info;
  }

  getStorageAmountPerByte = memoizee(
    async () => {
      const cli = await this._getNearCli();
      const {
        runtime_config: { storage_amount_per_byte },
      }: { runtime_config: { storage_amount_per_byte: string } } =
        await cli.rpc.call('EXPERIMENTAL_protocol_config', {
          finality: cli.defaultFinality,
        });
      return new BigNumber(storage_amount_per_byte);
    },
    { promise: true, primitive: true, maxAge: 1000 * 60 * 30 },
  );

  // Chain only functionalities below.

  override validateImportedCredential(input: string): Promise<boolean> {
    let ret = false;
    if (this.settings.importedAccountEnabled) {
      const [prefix, encoded] = input.split(':');
      try {
        ret =
          prefix === 'ed25519' &&
          Buffer.from(baseDecode(encoded)).length === 64;
      } catch {
        // pass
      }
    }
    return Promise.resolve(ret);
  }

  // TODO batch rpc call not supports by near
  async fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    const cli = await this._getNearCli();
    // https://docs.near.org/docs/roles/integrator/fungible-tokens#get-info-about-the-ft
    const results: PartialTokenInfo[] = await Promise.all(
      tokenAddresses.map(async (addr) =>
        cli.callContract(addr, 'ft_metadata', {}),
      ),
    );
    return results;
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ) {
    const cli = await this._getNearCli();
    // TODO batch call? helperApi
    return cli.batchCall2SingleCall(
      requests,
      async ({ address, tokenAddress }) => {
        if (typeof tokenAddress !== 'undefined') {
          const tokenBalanceStr: string = await cli.callContract(
            tokenAddress,
            'ft_balance_of',
            { account_id: address },
          );
          return new BigNumber(tokenBalanceStr);
        }
        const {
          amount,
          storage_usage: storageUsage,
        }: { amount: string; storage_usage: number } = await cli.rpc.call(
          'query',
          {
            request_type: 'view_account',
            account_id: address,
            finality: cli.defaultFinality,
          },
        );
        return new BigNumber(amount);
      },
    );
  }

  override async getFrozenBalance() {
    const cli = await this._getNearCli();
    const address = await this.getAccountAddress();
    const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);
    try {
      const {
        storage_usage: storageUsage,
      }: { amount: string; storage_usage: number } = await cli.rpc.call(
        'query',
        {
          request_type: 'view_account',
          account_id: address,
          finality: cli.defaultFinality,
        },
      );
      return {
        'main': new BigNumber(await this.getStorageAmountPerByte())
          .times(storageUsage)
          .shiftedBy(-decimals)
          .toNumber(),
      };
    } catch {
      return 0;
    }
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const cli: NearCli = await this._createNearCli(url, this.networkId);
    const start = performance.now();
    const { blockNumber: latestBlock } = await cli.getBestBlock();
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  override async getPrivateKeyByCredential(credential: string) {
    let privateKey;
    const [prefix, encoded] = credential.split(':');
    const decodedPrivateKey = Buffer.from(baseDecode(encoded));
    if (prefix === 'ed25519' && decodedPrivateKey.length === 64) {
      privateKey = decodedPrivateKey.slice(0, 32);
    }
    return Promise.resolve(privateKey);
  }

  override async getTransactionStatuses(
    txIds: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const cli: NearCli = await this._getNearCli();
    const transactionStatuses = await Promise.all(
      txIds.map((txId) =>
        cli
          .getTransactionStatus(txId)
          .then((transactionStatus) => transactionStatus)
          .catch(() => TransactionStatus.PENDING),
      ),
    );
    return transactionStatuses;
  }

  override validateWatchingCredential(input: string): Promise<boolean> {
    return Promise.resolve(
      this.settings.watchingAccountEnabled && verifyNearAddress(input).isValid,
    );
  }

  override async validateAddress(address: string): Promise<string> {
    const result = verifyNearAddress(address);
    if (result.isValid) {
      return Promise.resolve(result.normalizedAddress || address);
    }
    return Promise.reject(new InvalidAddress());
  }

  override async validateTokenAddress(address: string): Promise<string> {
    return this.validateAddress(address);
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
    options?: any,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const cli = await this._getNearCli();
    const txid = await cli.broadcastTransaction(signedTx.rawTx);
    debugLogger.engine.info('broadcastTransaction END:', {
      txid,
      rawTx: signedTx.rawTx,
    });
    return {
      ...signedTx,
      txid,
      encodedTx: signedTx.encodedTx,
    };
  }
}
