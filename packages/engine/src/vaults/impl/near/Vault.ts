/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, camelcase, @typescript-eslint/naming-convention */
import {
  NearCli,
  Provider as NearProvider,
} from '@onekeyfe/blockchain-libs/dist/provider/chains/near';
import { NearAccessKey } from '@onekeyfe/blockchain-libs/dist/provider/chains/near/nearcli';
import {
  PartialTokenInfo,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import axios from 'axios';
import BigNumber from 'bignumber.js';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { NotImplemented } from '../../../errors';
import { fillUnsignedTx } from '../../../proxy';
import { DBAccount, DBVariantAccount } from '../../../types/account';
import { TxStatus } from '../../../types/covalent';
import { Token } from '../../../types/token';
import {
  IApproveInfo,
  IDecodedTx,
  IEncodedTxAny,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  ISignCredentialOptions,
  ITransferInfo,
} from '../../../types/vault';
import { VaultBase } from '../../VaultBase';
import {
  EVMDecodedItem,
  EVMDecodedItemERC20Transfer,
  EVMDecodedTxType,
} from '../evm/decoder/types';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { INearAccountStorageBalance } from './types';
import {
  BN,
  FT_MINIMUM_STORAGE_BALANCE,
  FT_MINIMUM_STORAGE_BALANCE_LARGE,
  FT_STORAGE_DEPOSIT_GAS,
  FT_TRANSFER_DEPOSIT,
  FT_TRANSFER_GAS,
  baseDecode,
  baseEncode,
  deserializeTransaction,
  nearApiJs,
  parseJsonFromRawResponse,
  serializeTransaction,
} from './utils';

// TODO extends evm/Vault
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
  };

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

  // TODO rename to prop get client();
  async _getNearCli(): Promise<NearCli> {
    const nearCli2 = await (this.engineProvider as NearProvider).nearCli;

    const { rpcURL } = await this.getNetwork();
    // TODO add timeout params
    // TODO cache by rpcURL
    // TODO replace in ProviderController.getClient()
    const nearCli = new NearCli(`${rpcURL}`);
    const chainInfo = await this.engine.providerManager.getChainInfoByNetworkId(
      this.networkId,
    );
    // TODO move to base, setChainInfo like what ProviderController.getClient() do
    nearCli.setChainInfo(chainInfo);
    // nearCli.rpc.timeout = 60 * 1000;
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

    const verifier = this.engine.providerManager.getVerifier(
      this.networkId,
      dbAccount.pub,
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

  attachFeeInfoToEncodedTx(params: {
    encodedTx: any;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<any> {
    return Promise.resolve(params.encodedTx);
  }

  getActionInfo(nativeTx: nearApiJs.transactions.Transaction) {
    let txAction = nativeTx.actions.length === 1 ? nativeTx.actions[0] : null;
    const isNativeTransfer = txAction && txAction?.enum === 'transfer';
    const defaultResult = {
      txType: EVMDecodedTxType.NATIVE_TRANSFER,
      actionInfo: txAction?.transfer,
    };
    if (isNativeTransfer) {
      return defaultResult;
    }
    const testIsTokenTransfer = (
      action: nearApiJs.transactions.Action | null,
    ) =>
      action &&
      action.enum === 'functionCall' &&
      action?.functionCall?.methodName === 'ft_transfer';
    let isTokenTransfer = testIsTokenTransfer(txAction);
    if (!isTokenTransfer) {
      txAction = nativeTx.actions.length === 2 ? nativeTx.actions[1] : null;
    }
    isTokenTransfer = testIsTokenTransfer(txAction);
    if (isTokenTransfer) {
      return {
        txType: EVMDecodedTxType.TOKEN_TRANSFER,
        actionInfo: txAction?.functionCall,
      };
    }
    return defaultResult;
  }

  async decodeTx(encodedTx: IEncodedTxAny, payload?: any): Promise<IDecodedTx> {
    const nativeTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as nearApiJs.transactions.Transaction;
    const network = await this.getNetwork();
    const { txType, actionInfo } = this.getActionInfo(nativeTx);

    let info = null;
    if (txType === EVMDecodedTxType.TOKEN_TRANSFER) {
      const tokenIdOnNetwork = nativeTx.receiverId;
      const token = await this.engine.getOrAddToken(
        this.networkId,
        tokenIdOnNetwork,
        true,
      );
      if (token) {
        // TODO use near sdk parse token transfer
        const transferData = parseJsonFromRawResponse(
          (actionInfo as nearApiJs.transactions.FunctionCall)?.args,
        ) as {
          receiver_id: string;
          amount: string;
        };
        const value = transferData.amount;
        const amount = new BigNumber(value)
          .shiftedBy(token.decimals * -1)
          .toFixed();
        const tokenTransferInfo: EVMDecodedItemERC20Transfer | null = {
          type: EVMDecodedTxType.TOKEN_TRANSFER,
          token,
          amount,
          value,
          recipient: transferData.receiver_id,
        };
        info = tokenTransferInfo;
      }
    }
    const valueOnChain =
      txType === EVMDecodedTxType.NATIVE_TRANSFER
        ? (actionInfo as nearApiJs.transactions.Transfer).deposit.toString()
        : '0';
    const amount = new BigNumber(valueOnChain)
      .shiftedBy(network.decimals * -1)
      .toFixed();
    const decodedTx: EVMDecodedItem = {
      txType,
      blockSignedAt: 0,
      fromType: 'OUT',
      txStatus: TxStatus.Pending,
      mainSource: 'raw',

      symbol: network.symbol,
      amount,
      value: valueOnChain,
      network,

      fromAddress: nativeTx.signerId,
      toAddress: nativeTx.receiverId,
      nonce: parseFloat(nativeTx.nonce.toString()),
      txHash: baseEncode(nativeTx.blockHash),

      info, // tokenTransferInfo
      // @ts-ignore
      _infoActionsLength: nativeTx.actions.length,

      gasInfo: {
        gasLimit: 0,
        gasPrice: '0',
        maxFeePerGas: '0',
        maxPriorityFeePerGas: '0',
        maxPriorityFeePerGasInGwei: '0',
        maxFeePerGasInGwei: '0',
        maxFeeSpend: '0',
        feeSpend: '0',
        gasUsed: 0,
        gasUsedRatio: 0,
        effectiveGasPrice: '0',
        effectiveGasPriceInGwei: '0',
      },

      data: '',
      chainId: 0,

      total: '0',
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

    const actions = [];

    // token transfer
    if (transferInfo.token) {
      // TODO transferInfo.from and transferInfo.to cannot be the same
      // TODO pass token from ITransferInfo
      const token = await this.engine.getOrAddToken(
        this.networkId,
        transferInfo.token ?? '',
        true,
      );
      if (token) {
        const hasStorageBalance = await this.isStorageBalanceAvailable({
          address: transferInfo.to,
          tokenAddress: transferInfo.token,
        });
        if (!hasStorageBalance) {
          actions.push(
            await this._buildStorageDepositAction({
              // amount: new BN(FT_MINIMUM_STORAGE_BALANCE ?? '0'), // TODO small storage deposit
              amount: new BN(FT_MINIMUM_STORAGE_BALANCE_LARGE ?? '0'),
              address: transferInfo.to,
            }),
          );
        }
        // token transfer
        actions.push(
          await this._buildTokenTransferAction({
            transferInfo,
            token,
          }),
        );
      }
    } else {
      // native token transfer
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

  async buildUnsignedTxFromEncodedTx(encodedTx: any): Promise<UnsignedTx> {
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

    const unsignedTx: UnsignedTx = {
      inputs: [],
      outputs: [],
      payload: {
        nativeTx,
      },
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
    const price = priceInfo.normal.price.toFixed();
    const { transfer_cost, action_receipt_creation_config } = txCostConfig;
    const network = await this.getNetwork();
    let limit = '0';

    // hard to estimate gas of function call
    limit = new BigNumber(FT_TRANSFER_GAS).toFixed();

    const decodedTx = await this.decodeTx(encodedTx);
    if (decodedTx?.txType === EVMDecodedTxType.TOKEN_TRANSFER) {
      const info = decodedTx.info as EVMDecodedItemERC20Transfer;
      const hasStorageBalance = await this.isStorageBalanceAvailable({
        address: info.recipient,
        tokenAddress: info.token.tokenIdOnNetwork,
      });
      if (!hasStorageBalance) {
        // tokenTransfer with token activation
        limit = new BigNumber(transfer_cost.execution)
          .plus(action_receipt_creation_config.execution)
          .multipliedBy(2)
          .toFixed();
      }
    }

    return {
      editable: false,

      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      symbol: network.feeSymbol,
      decimals: network.feeDecimals,

      limit,
      prices: [price],

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
    encodedTx: IEncodedTxAny,
    amount: string,
  ): Promise<IEncodedTxAny> {
    throw new Error('Method not implemented: updateEncodedTxTokenApprove');
  }

  createClientFromURL(url: string): any {
    throw new Error('Method not implemented: createClientFromURL');
  }

  getExportedCredential(password: string): Promise<string> {
    throw new Error('Method not implemented: getExportedCredential');
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

  // TODO cache
  async isStorageBalanceAvailable({
    address,
    tokenAddress,
  }: {
    tokenAddress: string;
    address: string;
  }) {
    const storageBalance = await this.fetchAccountStorageBalance({
      address,
      tokenAddress,
    });
    return storageBalance?.total !== undefined;
  }

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
}
