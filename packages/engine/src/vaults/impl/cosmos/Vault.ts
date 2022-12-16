/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { hexToBytes } from '@noble/hashes/utils';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';
import { get } from 'lodash';
import memoizee from 'memoizee';

import {
  InvalidAddress,
  InvalidTokenAddress,
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/engine/src/errors';
import { parseNetworkId } from '@onekeyhq/engine/src/managers/network';
import type {
  DBSimpleAccount,
  DBVariantAccount,
} from '@onekeyhq/engine/src/types/account';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import {
  convertFeeGweiToValue,
  convertFeeValueToGwei,
} from '../../utils/feeInfoUtils';
import { addHexPrefix, stripHexPrefix } from '../../utils/hexUtils';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { CosmosNodeClient } from './NodeClient';
import {
  baseAddressToAddress,
  isValidAddress,
  isValidContractAddress,
} from './sdk/address';
import { TxAminoBuilder } from './sdk/amino/TxAminoBuilder';
import { MessageType } from './sdk/message';
import { queryRegistry } from './sdk/query/IQuery';
import { MintScanQuery } from './sdk/query/MintScanQuery';
import { Type } from './sdk/query/mintScanTypes';
import { serializeSignedTx } from './sdk/txBuilder';
import { TxMsgBuilder } from './sdk/txMsgBuilder';
import {
  getFee,
  getMsgs,
  getSequence,
  setFee,
  setSendAmount,
} from './sdk/wrapper/utils';
import settings from './settings';
import { getTransactionTypeByProtoMessage } from './utils';

import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionTokenTransfer,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { TxBuilder } from './sdk/txBuilder';
import type { CosmosImplOptions, IEncodedTxCosmos, StdFee } from './type';
import type { BaseClient } from '@onekeyfe/blockchain-libs/dist/provider/abc';
import type { PartialTokenInfo } from '@onekeyfe/blockchain-libs/dist/types/provider';
import type { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';

const GAS_STEP_MULTIPLIER = 10000;
const GAS_ADJUSTMENT: Record<string, string> = {
  // [OnekeyNetwork.terra]: '2',
  default: '1.3',
};
const GAS_PRICE = ['0.01', '0.025', '0.04'];

// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  getClientCache = memoizee((rpcUrl) => this.getNodeClient(rpcUrl), {
    promise: true,
    max: 1,
  });

  msgBuilder = new TxMsgBuilder();

  txBuilder: TxBuilder = new TxAminoBuilder();

  async getContractClient() {
    return Promise.resolve(queryRegistry.get(this.networkId));
  }

  getNodeClient(url: string) {
    return new CosmosNodeClient(url);
  }

  async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(rpcURL);
  }

  private async getChainInfo() {
    const chainInfo = await this.engine.providerManager.getChainInfoByNetworkId(
      this.networkId,
    );
    return chainInfo;
  }

  // Chain only methods

  override createClientFromURL(_url: string): BaseClient {
    // This isn't needed.
    throw new NotImplemented();
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = this.getNodeClient(url);

    const start = performance.now();
    const { height: blockNumber } = await client.fetchBlockHeader();
    const latestBlock = parseInt(blockNumber);
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  async _getPublicKey({
    prefix = true,
  }: {
    prefix?: boolean;
  } = {}): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    let publicKey = dbAccount.pub;
    if (prefix) {
      publicKey = addHexPrefix(publicKey);
    }
    return Promise.resolve(publicKey);
  }

  async getKey(networkId: string, accountId: string) {
    const account = (await this.engine.dbApi.getAccount(
      accountId,
    )) as DBVariantAccount;

    const chainInfo = await this.engine.providerManager.getChainInfoByNetworkId(
      this.networkId,
    );

    const address = baseAddressToAddress(
      chainInfo.implOptions?.addressPrefix ?? 'cosmos',
      account.address,
    );

    return {
      name: account.name,
      algo: 'ed25519',
      pubKey: account.pub,
      address: account.address,
      bech32Address: address,
      isNanoLedger: false,
    };
  }

  override async validateAddress(address: string) {
    const chainInfo = await this.getChainInfo();

    const valid = isValidAddress(address, chainInfo.implOptions.addressPrefix);
    if (!valid) {
      return Promise.reject(new InvalidAddress());
    }
    return Promise.resolve(address);
  }

  private isIbcToken(tokenAddress: string) {
    return (
      tokenAddress.indexOf('/') !== -1 &&
      tokenAddress.split('/')[0].toLowerCase() === 'ibc'
    );
  }

  override async validateTokenAddress(tokenAddress: string): Promise<string> {
    const chainInfo = await this.getChainInfo();

    if (this.isIbcToken(tokenAddress)) {
      const [prefix, address] = tokenAddress.split('/');
      const normalizationAddress = `${prefix.toLowerCase()}/${address.toUpperCase()}`;
      const query = new MintScanQuery();
      const results = await query.fetchAssertInfos(this.networkId);
      if (!results) {
        return Promise.reject(new InvalidTokenAddress());
      }

      const token = results.find((item) => {
        if (item.type === Type.Ibc && item.denom === normalizationAddress) {
          return true;
        }
        return false;
      });

      if (token) {
        return Promise.resolve(normalizationAddress);
      }
      return Promise.reject(new InvalidTokenAddress());
    }

    const valid = isValidContractAddress(
      tokenAddress,
      chainInfo.implOptions.addressPrefix,
    );
    if (!valid) {
      return Promise.reject(new InvalidTokenAddress());
    }
    return Promise.resolve(tokenAddress);
  }

  override validateWatchingCredential(input: string) {
    if (!this.settings.watchingAccountEnabled) return Promise.resolve(false);

    return this.validateAddress(input)
      .then((address) => !!address && address.length > 0)
      .catch(() => false);
  }

  override async checkAccountExistence(address: string): Promise<boolean> {
    const client = await this.getClient();

    const accountData = await client.getAccountInfo(address);
    return !!accountData;
  }

  override async getAccountNonce(): Promise<number | null> {
    const client = await this.getClient();
    const accountInfo = await client.getAccountInfo(
      await this.getAccountAddress(),
    );

    return new BigNumber(accountInfo?.sequence ?? '0').toNumber();
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    const chainInfo = (await this.getChainInfo())
      .implOptions as CosmosImplOptions;

    const contractClient = await this.getContractClient();

    return Promise.all(
      requests.map(async ({ address, tokenAddress }) => {
        try {
          const isNativeCoin = !tokenAddress;
          const isIBCToken = tokenAddress && this.isIbcToken(tokenAddress);

          if (isNativeCoin || isIBCToken) {
            const balances = await client.getAccountBalances(address);

            if (isNativeCoin) {
              const balance = balances.find(
                (b) => b.denom === chainInfo.mainCoinDenom,
              );
              return new BigNumber(balance?.amount ?? '0');
            }
            if (isIBCToken) {
              const balance = balances.find((b) => b.denom === tokenAddress);
              return new BigNumber(balance?.amount ?? '0');
            }
          }

          if (!contractClient) throw new Error('Contract client not found');
          return await contractClient
            .queryCw20TokenBalance(
              {
                networkId: this.networkId,
                axios: client.axios,
              },
              tokenAddress,
              [address],
            )
            .then((balance) => balance[0].balance);
        } catch (error) {
          // ignore account error
        }
      }),
    );
  }

  override async fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo>> {
    const ibcTokenAddresses = tokenAddresses
      .filter((tokenAddress) => this.isIbcToken(tokenAddress))
      .reduce((acc, tokenAddress) => {
        const [prefix, address] = tokenAddress.split('/');
        const normalizationAddress = `${prefix.toLowerCase()}/${address.toUpperCase()}`;
        acc.add(normalizationAddress);
        return acc;
      }, new Set<string>());

    const tokens = [];

    if (ibcTokenAddresses.size > 0) {
      const query = new MintScanQuery();
      const results = await query.fetchAssertInfos(this.networkId);
      if (!results) {
        return Promise.resolve([]);
      }

      const ibcTokens = results.reduce((acc, item) => {
        if (item.type === Type.Ibc && ibcTokenAddresses.has(item.denom)) {
          acc.push({
            name: `${item.dp_denom}(${item.channel ?? ''})`,
            symbol: item.dp_denom,
            decimals: item.decimal,
          });
        }
        return acc;
      }, [] as Array<PartialTokenInfo>);
      tokens.push(...ibcTokens);
    }

    const contractClient = await this.getContractClient();

    if (!contractClient) return [];

    const client = await this.getClient();

    const cw20TokenAddress = tokenAddresses.filter(
      (tokenAddress) => !this.isIbcToken(tokenAddress),
    );

    await contractClient
      .queryCw20TokenInfo(
        {
          networkId: this.networkId,
          axios: client.axios,
        },
        cw20TokenAddress,
      )
      .then((cw20Tokens) =>
        cw20Tokens.map((token) => ({
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
        })),
      )
      .then((cw20Tokens) => {
        tokens.push(...cw20Tokens);
      })
      .catch(() => {});

    return tokens;
  }

  override async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxCosmos;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxCosmos> {
    const { price, limit } = params.feeInfoValue;

    if (!price || typeof price !== 'string') {
      throw new OneKeyInternalError('Invalid gas price.');
    }
    if (typeof limit !== 'string') {
      throw new OneKeyInternalError('Invalid fee limit');
    }
    const network = await this.getNetwork();

    const priceValue = convertFeeGweiToValue({
      value: price,
      network,
    });

    const txPrice = new BigNumber(
      parseFloat(priceValue) * parseFloat(limit),
    ).toFixed(0);

    const fee = getFee(params.encodedTx);

    const newFee: StdFee = {
      amount:
        fee && fee.amount.length > 0
          ? [
              {
                denom: fee.amount[0].denom,
                amount: txPrice,
              },
            ]
          : [],
      gas_limit: limit,
      payer: fee?.payer ?? '',
      granter: fee?.granter ?? '',
      feePayer: fee?.feePayer ?? '',
    };

    setFee(params.encodedTx, newFee);
    return params.encodedTx;
  }

  override decodedTxToLegacy(
    _decodedTx: IDecodedTx,
  ): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async decodeTx(
    encodedTx: IEncodedTxCosmos,
    _payload?: any,
  ): Promise<IDecodedTx> {
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    let token: Token | undefined = await this.engine.getNativeTokenInfo(
      this.networkId,
    );
    const chainInfo = await this.getChainInfo();

    const msgs = getMsgs(encodedTx);

    const actions = [];
    for (const msg of msgs) {
      let action: IDecodedTxAction | null = null;
      const actionType = getTransactionTypeByProtoMessage(
        msg,
        chainInfo?.implOptions?.mainCoinDenom,
      );

      if (
        actionType === IDecodedTxActionType.NATIVE_TRANSFER ||
        actionType === IDecodedTxActionType.TOKEN_TRANSFER
      ) {
        let actionKey = 'nativeTransfer';
        const { amount, fromAddress, toAddress }: MsgSend =
          'unpacked' in msg ? msg.unpacked : msg.value;
        const amountNumber = amount[0].amount;
        const amountDenom = amount[0].denom;

        if (actionType === IDecodedTxActionType.TOKEN_TRANSFER) {
          actionKey = 'tokenTransfer';
          token = await this.engine.ensureTokenInDB(
            this.networkId,
            amountDenom,
          );
          if (!token) {
            throw new Error('Invalid token address');
          }
        }

        const transferAction: IDecodedTxActionTokenTransfer = {
          tokenInfo: token,
          to: toAddress,
          from: fromAddress,
          amount: new BigNumber(amountNumber)
            .shiftedBy(-token.decimals)
            .toFixed(),
          amountValue: amountNumber,
          extraInfo: null,
        };
        action = {
          type: actionType,
          [actionKey]: transferAction,
        };
      } else {
        action = {
          type: IDecodedTxActionType.UNKNOWN,
          direction: IDecodedTxDirection.OTHER,
          unknownAction: {
            extraInfo: {},
          },
        };
      }
      if (action) actions.push(action);
    }

    const fee = getFee(encodedTx);
    const sequence = getSequence(encodedTx);

    let feePrice = GAS_PRICE[0];
    if (fee?.gas_limit) {
      feePrice = new BigNumber(fee?.amount[0]?.amount ?? '1')
        .div(fee?.gas_limit)
        .toFixed(6);
    }

    const result: IDecodedTx = {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: sequence.toNumber(),
      actions,
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: {
        price: convertFeeValueToGwei({
          value: feePrice,
          network,
        }),
        limit: fee?.gas_limit ?? undefined,
      },
      extraInfo: null,
      encodedTx,
    };

    return Promise.resolve(result);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxCosmos> {
    const { to, amount, token: tokenAddress } = transferInfo;
    const { address: from } = await this.getDbAccount();
    const chainInfo = await this.getChainInfo();
    const { chainId } = parseNetworkId(this.networkId);

    if (!chainId) {
      throw new Error('Invalid networkId');
    }

    let message;
    if (tokenAddress && tokenAddress !== '') {
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tokenAddress,
      );

      if (typeof token === 'undefined') {
        throw new OneKeyInternalError('Failed to get token info.');
      }

      const amountValue = new BigNumber(amount)
        .shiftedBy(token.decimals)
        .toFixed();

      if (this.isIbcToken(tokenAddress)) {
        message = this.msgBuilder.makeSendNativeMsg(
          from,
          to,
          amountValue,
          tokenAddress,
        );
      } else {
        message = this.msgBuilder.makeSendCwTokenMsg(
          from,
          tokenAddress,
          to,
          amountValue,
        );
      }
    } else {
      const network = await this.getNetwork();
      const amountValue = new BigNumber(amount)
        .shiftedBy(network.decimals)
        .toFixed();

      message = this.msgBuilder.makeSendNativeMsg(
        from,
        to,
        amountValue,
        chainInfo?.implOptions?.mainCoinDenom,
      );
    }

    const client = await this.getClient();
    const accountInfo = await client.getAccountInfo(from);
    if (!accountInfo) {
      throw new Error('Invalid account');
    }

    const pubkey = hexToBytes(stripHexPrefix(await this._getPublicKey()));

    return this.txBuilder.makeTxWrapper(message, {
      memo: '',
      gasLimit: '0',
      feeAmount: '1',
      pubkey,
      mainCoinDenom: chainInfo?.implOptions?.mainCoinDenom,
      chainId,
      accountNumber: accountInfo.account_number,
      nonce: accountInfo.sequence,
    });
  }

  override buildEncodedTxFromApprove(
    _approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  override updateEncodedTxTokenApprove(
    _encodedTx: IEncodedTx,
    _amount: string,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxCosmos,
  ): Promise<IUnsignedTxPro> {
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    return Promise.resolve({
      inputs: [
        {
          address: dbAccount.address,
          value: new BigNumber(0),
          publicKey: dbAccount.pub,
        },
      ],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  async fetchFeeConfig(): Promise<BigNumber[]> {
    const chainInfo = await this.getChainInfo();
    const iml = chainInfo.implOptions as CosmosImplOptions;
    const { low, normal, high } = iml.gasPriceStep || {};

    return [
      new BigNumber(low ?? GAS_PRICE[0]),
      new BigNumber(normal ?? GAS_PRICE[1]),
      new BigNumber(high ?? GAS_PRICE[2]),
    ];
  }

  async fetchFeeInfo(encodedTx: IEncodedTxCosmos): Promise<IFeeInfo> {
    const [network, unsignedTx] = await Promise.all([
      this.getNetwork(),
      this.buildUnsignedTxFromEncodedTx(encodedTx),
    ]);
    const newEncodedTx = unsignedTx.encodedTx as IEncodedTxCosmos;

    let limit = getFee(newEncodedTx).gas_limit;

    const prices = (await this.fetchFeeConfig()).map((item) =>
      convertFeeValueToGwei({
        value: item.toFixed(),
        network,
      }),
    );

    try {
      const client = await this.getClient();

      const publicKey = await this._getPublicKey();

      const rawTxBytes = serializeSignedTx({
        txWrapper: newEncodedTx,
        signature: {
          signatures: [new Uint8Array(64)],
        },
        publicKey: {
          pubKey: publicKey,
        },
      });

      if (!rawTxBytes) throw new Error('Invalid rawTxBytes');

      const txSimulation = await client.simulationTransaction({
        tx_bytes: Buffer.from(rawTxBytes).toString('base64'),
      });

      if (!txSimulation) throw new Error('Failed to get tx simulation');

      limit = new BigNumber(txSimulation.gas_used)
        .multipliedBy(GAS_ADJUSTMENT[this.networkId] ?? GAS_ADJUSTMENT.default)
        .toFixed(0);
    } catch (error) {
      const msgs = getMsgs(newEncodedTx);

      const msgSend = msgs.find(
        (item) =>
          // @ts-expect-error
          item?.typeUrl === MessageType.SEND || item?.type === MessageType.SEND,
      );

      if (msgSend) {
        const { amount }: { amount: Coin[] } =
          'unpacked' in msgSend ? msgSend.unpacked : msgSend.value;
        const chainInfo = await this.getChainInfo();
        // Main coin Max transfer
        if (
          amount &&
          amount.length > 0 &&
          amount[0].denom === chainInfo?.implOptions?.mainCoinDenom
        ) {
          limit = '100000';
        }
      }

      if (!limit || limit === '') {
        throw error;
      }
    }

    let defaultPresetIndex = '1';
    if (prices.length > 0 && prices[0] === '0') {
      defaultPresetIndex = '0';
    }

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit,
      prices,
      defaultPresetIndex,
    };
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    const client = await this.getClient();

    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    try {
      const txid = await client.broadcastTransaction(signedTx.rawTx);

      debugLogger.engine.info('broadcastTransaction Done:', {
        txid,
        rawTx: signedTx.rawTx,
      });

      if (!txid) throw new Error('broadcastTransaction failed');

      return {
        ...signedTx,
        txid,
      };
    } catch (error: any) {
      if (error instanceof OneKeyInternalError) {
        throw error;
      }

      const { errorCode, message } = error || {};
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new OneKeyInternalError(`${errorCode ?? ''} ${message}`);
    }
  }

  async updateEncodedTx(
    encodedTx: IEncodedTxCosmos,
    payload: IEncodedTxUpdatePayloadTransfer,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    const msgs = getMsgs(encodedTx);

    if (
      options.type === IEncodedTxUpdateType.transfer &&
      msgs.length > 0 &&
      msgs[0].typeUrl === MessageType.SEND
    ) {
      const network = await this.getNetwork();

      return Promise.resolve(
        setSendAmount(
          encodedTx,
          new BigNumber(payload.amount).shiftedBy(network.decimals).toFixed(),
        ),
      );
    }
    return Promise.resolve(encodedTx);
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return `0x${decrypt(password, encryptedPrivateKey).toString('hex')}`;
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [], tokenIdOnNetwork } = options;
    if (tokenIdOnNetwork) {
      // No token support now.
      return Promise.resolve([]);
    }

    const { getTimeStamp } = await CoreSDKLoader();
    const dbAccount = (await this.getDbAccount()) as DBVariantAccount;
    const chainInfo = await this.getChainInfo();
    let token: Token | undefined = await this.engine.getNativeTokenInfo(
      this.networkId,
    );

    const promises = localHistory.map(async (item) => {
      try {
        const encodedTx = item.decodedTx.encodedTx as
          | IEncodedTxCosmos
          | undefined;
        if (encodedTx) {
          const msgs = getMsgs(encodedTx);
          const fee = getFee(encodedTx);
          const sequence = getSequence(encodedTx);

          const actions = [];
          for (const msg of msgs) {
            let action: IDecodedTxAction | null = null;
            const actionType = getTransactionTypeByProtoMessage(
              msg,
              chainInfo?.implOptions?.mainCoinDenom,
            );

            if (
              actionType === IDecodedTxActionType.NATIVE_TRANSFER ||
              actionType === IDecodedTxActionType.TOKEN_TRANSFER
            ) {
              let actionKey = 'nativeTransfer';
              const { amount, fromAddress, toAddress }: MsgSend =
                'unpacked' in msg ? msg.unpacked : msg.value;

              const amountNumber = amount[0].amount;
              const amountDenom = amount[0].denom;

              if (actionType === IDecodedTxActionType.TOKEN_TRANSFER) {
                actionKey = 'tokenTransfer';
                token = await this.engine.ensureTokenInDB(
                  this.networkId,
                  amountDenom,
                );
              }

              if (!token) {
                throw new Error('Invalid token address');
              }

              const transferAction: IDecodedTxActionTokenTransfer = {
                tokenInfo: token,
                to: toAddress,
                from: fromAddress,
                amount: new BigNumber(amountNumber)
                  .shiftedBy(-token.decimals)
                  .toFixed(),
                amountValue: amountNumber,
                extraInfo: null,
              };
              action = {
                type: actionType,
                [actionKey]: transferAction,
              };
            } else {
              action = {
                type: IDecodedTxActionType.UNKNOWN,
                direction: IDecodedTxDirection.OTHER,
                unknownAction: {
                  extraInfo: {},
                },
              };
            }
            if (action) actions.push(action);
          }

          const feeValue = new BigNumber(fee?.amount[0]?.amount ?? '0');

          const decodedTx: IDecodedTx = {
            txid: item.decodedTx?.txid,
            owner: dbAccount.address,
            signer: item.decodedTx?.signer,
            nonce: sequence.toNumber(),
            actions,
            status: item.decodedTx?.status,
            networkId: this.networkId,
            accountId: this.accountId,
            encodedTx,
            extraInfo: null,
            totalFeeInNative: new BigNumber(feeValue)
              .shiftedBy(-(token?.decimals ?? 6))
              .toFixed(),
          };
          decodedTx.updatedAt = getTimeStamp();
          decodedTx.createdAt =
            item?.decodedTx.createdAt ?? decodedTx.updatedAt;
          decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
          return await this.buildHistoryTx({
            decodedTx,
            historyTxToMerge: item,
          });
        }
      } catch (error) {
        return undefined;
      }
    });

    return (await Promise.all(promises)).filter(Boolean);
  }

  override async getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const client = await this.getClient();

    return Promise.all(
      txids.map(async (txid) => {
        try {
          const tx = await client.getTransactionInfo(txid);

          const error = get(tx, 'code', undefined);
          let status = TransactionStatus.PENDING;
          if (error) {
            status = TransactionStatus.CONFIRM_BUT_FAILED;
          } else if (new BigNumber(tx.height).gt(0)) {
            status = TransactionStatus.CONFIRM_AND_SUCCESS;
          }
          return await Promise.resolve(status);
        } catch (error: any) {
          const { message } = error;

          if (message === '404' || message === '400') {
            return Promise.resolve(TransactionStatus.NOT_FOUND);
          }
        }
      }),
    );
  }

  override async addressFromBase(baseAddress: string) {
    const chainInfo = await this.getChainInfo();
    return baseAddressToAddress(
      chainInfo.implOptions?.addressPrefix ?? 'cosmos',
      baseAddress,
    );
  }
}
