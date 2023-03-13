/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import { defaultAbiCoder } from '@ethersproject/abi';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { find } from 'lodash';
import memoizee from 'memoizee';
import TronWeb from 'tronweb';

import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import { toBigIntHex } from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  InsufficientBalance,
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import { extractResponseError } from '../../../proxy';
import { IDecodedTxActionType, IDecodedTxStatus } from '../../types';
import { VaultBase } from '../../VaultBase';
import { Erc20MethodSelectors } from '../evm/decoder/abi';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { DBSimpleAccount } from '../../../types/account';
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
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type {
  IContractDetail,
  IEncodedTxTron,
  IOnChainHistoryTokenTx,
  IOnChainHistoryTx,
  IRPCCallResponse,
  ITokenDetail,
} from './types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const FAKE_OWNER_ADDRESS = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';
const SIGNATURE_LENGTH = 65;
const TX_RESULT_SIZE = 64;
const TX_SIZE_OVERHEAD = 5; // 1 byte raw_data key, 1 byte signature key, 1 byte signature number, 1 byte signature data length for 65 bytes, 1 byte tx result key. TODO: multisign support.
const INFINITE_AMOUNT_HEX =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

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
  private getTronWeb = memoizee(
    (rpcURL) => {
      const tronWeb = new TronWeb({ fullHost: rpcURL });
      tronWeb.setAddress(FAKE_OWNER_ADDRESS);
      return tronWeb;
    },
    {
      promise: true,
      max: 3,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  private getApiExplorerCache = memoizee(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (baseURL) => axios.create({ baseURL }),
    {
      primitive: true,
      promise: true,
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  async getApiExplorer() {
    const network = await this.engine.getNetwork(this.networkId);
    let baseURL = network.blockExplorerURL.name;
    if (network.isTestnet) {
      baseURL = network.blockExplorerURL.name.replace(/shasta/, 'shastapi');
    } else {
      baseURL = network.blockExplorerURL.name.replace(
        /(tronscan)/,
        'apilist.$1',
      );
    }
    return this.getApiExplorerCache(baseURL);
  }

  public async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getTronWeb(rpcURL);
  }

  getTokenContact = memoizee(
    async (tokenAddress) => {
      const apiExplorer = await this.getApiExplorer();
      const tokenContract = await apiExplorer.get<{
        status: { code: number };
        data: IContractDetail[];
      }>('api/contract', {
        params: {
          contract: tokenAddress,
        },
      });

      if (
        tokenContract?.data?.status?.code === 0 &&
        tokenContract?.data?.data?.length > 0
      ) {
        return tokenContract.data.data[0];
      }
    },
    {
      primitive: true,
      promise: true,
      max: 100,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  getTokenInfo = memoizee(
    async (tokenAddress) => {
      const tokenContract = await this.getTokenContact(tokenAddress);
      if (tokenContract && tokenContract.tokenInfo?.tokenId) {
        const { tokenInfo } = tokenContract;
        return {
          name: tokenInfo.tokenName,
          symbol: tokenInfo.tokenAbbr,
          decimals: tokenInfo.tokenDecimal,
          logoURI: tokenInfo.tokenLogo,
        };
      }
    },
    { promise: true, max: 100, maxAge: getTimeDurationMs({ minute: 3 }) },
  );

  getAccountTokens = memoizee(
    async (address: string) => {
      try {
        const apiExplorer = await this.getApiExplorer();
        const resp = await apiExplorer.get<{ data: ITokenDetail[] }>(
          'api/account/tokens',
          {
            params: {
              address,
            },
          },
        );

        const tokens = resp?.data?.data || [];
        return tokens;
      } catch {
        // pass
      }
    },
    {
      primitive: true,
      promise: true,
      max: 1,
      maxAge: getTimeDurationMs({ seconds: 30 }),
    },
  );

  getParameters = memoizee(
    async () => {
      const tronWeb = await this.getClient();
      return Object.fromEntries(
        (await tronWeb.trx.getChainParameters()).map(({ key, value }) => [
          key,
          value,
        ]),
      );
    },
    { promise: true, maxAge: getTimeDurationMs({ minute: 3 }) },
  );

  async getConsumableResource(address: string) {
    const tronWeb = await this.getClient();
    const {
      freeNetUsed = 0,
      freeNetLimit = 0,
      NetUsed: netUsed = 0,
      NetLimit: netLimit = 0,
      EnergyUsed: energyUsed = 0,
      EnergyLimit: energyLimit = 0,
    } = await tronWeb.trx.getAccountResources(address);
    return {
      freeBandwidth: freeNetLimit - freeNetUsed,
      stakedBandwidth: netLimit - netUsed,
      stakedEnergy: energyLimit - energyUsed,
    };
  }

  // Chain only methods

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const tronWeb = this.getTronWeb(url);
    const start = performance.now();
    const {
      result: { number: blockNumber },
    } = await tronWeb.fullNode.request(
      'jsonrpc',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      },
      'post',
    );
    const latestBlock = parseInt(blockNumber);
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  override async fetchTokenInfos(tokenAddresses: string[]) {
    return Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        try {
          return await this.getTokenInfo(tokenAddress);
        } catch {
          // pass
        }
      }),
    );
  }

  override validateAddress(address: string) {
    if (TronWeb.isAddress(address)) {
      return Promise.resolve(TronWeb.address.fromHex(address));
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateWatchingCredential(input: string) {
    return Promise.resolve(
      this.settings.watchingAccountEnabled && TronWeb.isAddress(input),
    );
  }

  override validateTokenAddress(address: string): Promise<string> {
    return this.validateAddress(address);
  }

  override async checkAccountExistence(address: string): Promise<boolean> {
    const tronWeb = await this.getClient();
    const { address: hexAddress } = await tronWeb.trx.getAccount(address);
    return typeof hexAddress !== 'undefined';
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ) {
    const tronWeb = await this.getClient();
    return Promise.all(
      requests.map(async ({ address, tokenAddress }) => {
        try {
          if (typeof tokenAddress === 'undefined') {
            return new BigNumber(await tronWeb.trx.getBalance(address));
          }

          const tokens = await this.getAccountTokens(address);
          if (tokens) {
            const token = find(tokens, { tokenId: tokenAddress });
            return new BigNumber(token?.balance ?? 0);
          }

          return new BigNumber(0);
        } catch {
          return new BigNumber(0);
        }
      }),
    );
  }

  override async getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const tronWeb = await this.getClient();
    return Promise.all(
      txids.map((txid) =>
        tronWeb.trx.getConfirmedTransaction(txid).then(
          ({ ret: [{ contractRet = '' }] }) =>
            contractRet === 'SUCCESS'
              ? TransactionStatus.CONFIRM_AND_SUCCESS
              : TransactionStatus.CONFIRM_BUT_FAILED,
          (e) =>
            e === 'Transaction not found'
              ? tronWeb.trx.getTransaction(txid).then(
                  () => TransactionStatus.PENDING,
                  (e2) =>
                    e2 === 'Transaction not found'
                      ? TransactionStatus.NOT_FOUND
                      : undefined,
                )
              : undefined,
        ),
      ),
    );
  }

  // TODO isContractAddress

  // Account related methods

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    return Promise.resolve(params.encodedTx);
  }

  override async decodeTx(
    uncastedEncodedTx: IEncodedTx,
    _payload?: any,
  ): Promise<IDecodedTx> {
    const encodedTx: IEncodedTxTron = uncastedEncodedTx as IEncodedTxTron;
    let action: IDecodedTxAction = { type: IDecodedTxActionType.UNKNOWN };
    if (encodedTx.raw_data.contract[0].type === 'TransferContract') {
      const {
        amount,
        owner_address: fromAddressHex,
        to_address: toAddressHex,
      } = encodedTx.raw_data.contract[0].parameter.value;
      const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
      action = {
        type: IDecodedTxActionType.NATIVE_TRANSFER,
        nativeTransfer: {
          tokenInfo: nativeToken,
          from: TronWeb.address.fromHex(fromAddressHex),
          to: TronWeb.address.fromHex(toAddressHex),
          amount: new BigNumber(amount)
            .shiftedBy(-nativeToken.decimals)
            .toFixed(),
          amountValue: amount.toString(),
          extraInfo: null,
        },
      };
    } else if (encodedTx.raw_data.contract[0].type === 'TriggerSmartContract') {
      const {
        contract_address: contractAddressHex,
        data,
        owner_address: fromAddressHex,
      } = encodedTx.raw_data.contract[0].parameter.value;
      try {
        const tokenAddress = TronWeb.address.fromHex(contractAddressHex);
        const [tokenInfo] = await this.fetchTokenInfos([tokenAddress]);
        if (
          typeof tokenInfo !== 'undefined' &&
          `0x${data.slice(0, 8)}` === Erc20MethodSelectors.tokenTransfer
        ) {
          const [toAddressHex, decodedAmount] = defaultAbiCoder.decode(
            ['address', 'uint256'],
            `0x${data.slice(8)}`,
          );
          const amountBN = new BigNumber(
            (decodedAmount as { _hex: string })._hex,
          );
          const token = await this.engine.ensureTokenInDB(
            this.networkId,
            tokenAddress,
          );
          if (typeof token !== 'undefined') {
            action = {
              type: IDecodedTxActionType.TOKEN_TRANSFER,
              tokenTransfer: {
                tokenInfo: token,
                from: TronWeb.address.fromHex(fromAddressHex),
                to: TronWeb.address.fromHex(toAddressHex),
                amount: amountBN.shiftedBy(-token.decimals).toFixed(),
                amountValue: amountBN.toFixed(),
                extraInfo: null,
              },
            };
          }
        }
      } catch (e) {
        // TODO: log error
        // Unable to parse, will be a unknown action
      }
    }

    const owner = await this.getAccountAddress();
    return {
      txid: encodedTx.txID,
      owner,
      signer: owner,
      nonce: 0,
      actions: [action],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
      encodedTx,
    };
  }

  override decodedTxToLegacy(
    _decodedTx: IDecodedTx,
  ): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTx> {
    const { from, to, amount, token: tokenAddress } = transferInfo;
    const tronWeb = await this.getClient();

    const token = await this.engine.ensureTokenInDB(
      this.networkId,
      tokenAddress || '',
    );
    if (!token) {
      throw new OneKeyInternalError(
        `Token not found: ${tokenAddress || 'TRX'}`,
      );
    }

    if (tokenAddress) {
      const {
        result: { result },
        transaction,
      } = await tronWeb.transactionBuilder.triggerSmartContract(
        tokenAddress,
        'transfer(address,uint256)',
        {},
        [
          { type: 'address', value: to },
          {
            type: 'uint256',
            value: new BigNumber(amount).shiftedBy(token.decimals).toFixed(0),
          },
        ],
        from,
      );
      if (!result) {
        throw new OneKeyInternalError(
          'Unable to build token transfer transaction',
        );
      }
      return transaction;
    }

    // TODO: handle insufficient balance case
    try {
      return await tronWeb.transactionBuilder.sendTrx(
        to,
        parseInt(new BigNumber(amount).shiftedBy(token.decimals).toFixed()),
        from,
      );
    } catch (e) {
      if (typeof e === 'string' && e.endsWith('balance is not sufficient.')) {
        throw new InsufficientBalance();
      } else if (typeof e === 'string') {
        throw new Error(e);
      } else {
        throw e;
      }
    }
  }

  override buildEncodedTxFromApprove(
    _approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override updateEncodedTxTokenApprove(
    _encodedTx: IEncodedTx,
    _amount: string,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override async updateEncodedTx(
    uncastedEncodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    const encodedTx: IEncodedTxTron = uncastedEncodedTx as IEncodedTxTron;

    // max native token transfer update
    if (
      options.type === 'transfer' &&
      encodedTx.raw_data.contract[0].type === 'TransferContract'
    ) {
      const tronWeb = await this.getClient();
      const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);
      const { owner_address: fromAddressHex, to_address: toAddressHex } =
        encodedTx.raw_data.contract[0].parameter.value;
      const { amount } = payload as IEncodedTxUpdatePayloadTransfer;

      return tronWeb.transactionBuilder.sendTrx(
        TronWeb.address.fromHex(toAddressHex),
        parseInt(new BigNumber(amount).shiftedBy(decimals).toFixed()),
        TronWeb.address.fromHex(fromAddressHex),
      );
    }

    return Promise.resolve(encodedTx);
  }

  override buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  override async fetchFeeInfo(
    uncastedEncodedTx: IEncodedTx,
  ): Promise<IFeeInfo> {
    let baseFee = 0;

    const network = await this.getNetwork();
    const encodedTx: IEncodedTxTron = uncastedEncodedTx as IEncodedTxTron;
    const parameters = await this.getParameters();
    const { freeBandwidth, stakedBandwidth, stakedEnergy } =
      await this.getConsumableResource(await this.getAccountAddress());

    const requiredBandwidth =
      encodedTx.raw_data_hex.length / 2 +
      SIGNATURE_LENGTH +
      TX_RESULT_SIZE +
      TX_SIZE_OVERHEAD;
    baseFee +=
      (requiredBandwidth > freeBandwidth && requiredBandwidth > stakedBandwidth
        ? requiredBandwidth
        : 0) * parameters.getTransactionFee;
    if (encodedTx.raw_data.contract[0].type === 'TransferContract') {
      // Account creation?
      const { to_address: toAddressHex } =
        encodedTx.raw_data.contract[0].parameter.value;
      if (
        !(await this.checkAccountExistence(
          TronWeb.address.fromHex(toAddressHex),
        ))
      ) {
        baseFee = parameters.getCreateNewAccountFeeInSystemContract;
        baseFee +=
          parameters.getCreateAccountFee > stakedBandwidth
            ? parameters.getCreateAccountFee
            : 0;
      }
    } else if (encodedTx.raw_data.contract[0].type === 'TriggerSmartContract') {
      const {
        contract_address: contractAddressHex,
        data,
        call_value: callValue,
        owner_address: fromAddressHex,
      } = encodedTx.raw_data.contract[0].parameter.value;
      const tronWeb = await this.getClient();
      const resp: IRPCCallResponse = await tronWeb.fullNode.request(
        'jsonrpc',
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_estimateGas',
          params: [
            {
              from: fromAddressHex,
              to: contractAddressHex,
              gas: '0x01',
              gasPrice: '0x01',
              value: toBigIntHex(new BigNumber(callValue ?? 0)),
              data,
            },
          ],
        },
        'post',
      );

      if (resp.error && resp.error.message) {
        throw new Error(resp.error.message);
      }

      const requiredEnergy = parseInt(resp.result);
      if (requiredEnergy > stakedEnergy) {
        baseFee += requiredEnergy * parameters.getEnergyFee;
      }
    }

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      // TODO
      limit: '0',
      prices: ['0'],
      defaultPresetIndex: '0',

      tx: null, // Must be null if network not support feeInTx
      baseFeeValue: new BigNumber(baseFee.toString())
        .shiftedBy(-network.feeDecimals)
        .toFixed(),
    };
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });

    const tronWeb = await this.getClient();
    const ret = await tronWeb.trx.sendRawTransaction(
      JSON.parse(signedTx.rawTx),
    );

    if (typeof ret.code !== 'undefined') {
      throw new OneKeyInternalError(
        `${ret.code} ${Buffer.from(ret.message || '', 'hex').toString()}`,
      );
    }

    debugLogger.engine.info('broadcastTransaction END:', {
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    });
    return signedTx;
  }

  override async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return decrypt(password, encryptedPrivateKey).toString('hex');
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

    let tokenOnChainHistory: IOnChainHistoryTokenTx[] = [];
    let nativeTokenOnChainHistory: IOnChainHistoryTx[] = [];

    const tronWeb = await this.getClient();
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);

    tokenOnChainHistory = (
      (await tronWeb.fullNode.request(
        `v1/accounts/${
          dbAccount.address
        }/transactions/trc20?only_confirmed=true${
          tokenIdOnNetwork ? `&&contract_address=${tokenIdOnNetwork}` : ''
        }`,
      )) as {
        data: IOnChainHistoryTokenTx[];
      }
    ).data;

    if (!tokenIdOnNetwork) {
      nativeTokenOnChainHistory = (
        (await tronWeb.fullNode.request(
          `v1/accounts/${dbAccount.address}/transactions/?only_confirmed=true`,
        )) as {
          data: IOnChainHistoryTx[];
        }
      ).data;
    }

    const tokenHistoryPromises = tokenOnChainHistory.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.transaction_id,
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        return Promise.resolve(null);
      }

      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tx.token_info.address,
      );

      if (!token) {
        return Promise.resolve(null);
      }

      const txDetail = await tronWeb.trx.getTransactionInfo(tx.transaction_id);

      const amountBN = new BigNumber(tx.value);

      let action: IDecodedTxAction = {
        type: IDecodedTxActionType.UNKNOWN,
      };

      if (tx.type === 'Transfer') {
        action = {
          type: IDecodedTxActionType.TOKEN_TRANSFER,
          tokenTransfer: {
            tokenInfo: token,
            from: tx.from,
            to: tx.to,
            amount: amountBN.shiftedBy(-token.decimals).toFixed(),
            amountValue: amountBN.toFixed(),
            extraInfo: null,
          },
        };
      }

      if (tx.type === 'Approval') {
        action = {
          type: IDecodedTxActionType.TOKEN_APPROVE,
          tokenApprove: {
            tokenInfo: token,
            owner: tx.from,
            spender: tx.to,
            isMax: toBigIntHex(amountBN) === INFINITE_AMOUNT_HEX,
            amount: amountBN.shiftedBy(-token.decimals).toFixed(),
            amountValue: amountBN.toFixed(),
            extraInfo: null,
          },
        };
      }
      try {
        const decodedTx: IDecodedTx = {
          txid: tx.transaction_id,

          owner: tx.from,
          signer: tx.from,
          totalFeeInNative: new BigNumber(txDetail.fee ?? 0)
            .shiftedBy(-decimals)
            .toFixed(),
          actions: [action],
          accountId: this.accountId,
          networkId: this.networkId,
          status: IDecodedTxStatus.Confirmed,
          updatedAt: tx.block_timestamp,
          createdAt:
            historyTxToMerge?.decodedTx.createdAt ?? tx.block_timestamp,
          isFinal: true,
          extraInfo: null,
          nonce: 0,
        };
        return await this.buildHistoryTx({ decodedTx, historyTxToMerge });
      } catch (e) {
        debugLogger.common.error(e);
      }

      return Promise.resolve(null);
    });
    const nativeTokenPromises = nativeTokenOnChainHistory.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.txID,
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        const {
          block_timestamp: blockTime,
          ret: [{ contractRet, fee }],
        } = tx;
        const decodedTx: IDecodedTx = {
          ...(await this.decodeTx(tx)),
          txid: tx.txID,
          totalFeeInNative: new BigNumber(fee).shiftedBy(-decimals).toFixed(),
          status:
            contractRet === 'SUCCESS'
              ? IDecodedTxStatus.Confirmed
              : IDecodedTxStatus.Failed,
          updatedAt: blockTime,
          createdAt: historyTxToMerge?.decodedTx.createdAt ?? blockTime,
          isFinal: true,
        };
        return await this.buildHistoryTx({ decodedTx, historyTxToMerge });
      } catch (e) {
        debugLogger.common.error(e);
      }

      return Promise.resolve(null);
    });

    const tokenHistory = (await Promise.all(tokenHistoryPromises)).filter(
      Boolean,
    );
    const nativeTokenHistory = (await Promise.all(nativeTokenPromises)).filter(
      Boolean,
    );

    return [...tokenHistory, ...nativeTokenHistory];
  }

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    try {
      const tronWeb = await this.getClient();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return await tronWeb.fullNode.request('jsonrpc', request, 'post');
    } catch (e) {
      throw extractResponseError(e);
    }
  }
}
