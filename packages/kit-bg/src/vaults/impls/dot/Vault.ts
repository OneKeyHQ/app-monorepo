/* eslint-disable @typescript-eslint/no-unused-vars */
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { decode, getRegistry, methods } from '@substrate/txwrapper-polkadot';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil, isObject } from 'lodash';

import { serializeSignedTransaction } from '@onekeyhq/core/src/chains/dot/sdkDot';
import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  BalanceLowerMinimum,
  InvalidTransferValue,
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import {
  EOnChainHistoryTransferType,
  type IOnChainHistoryTx,
  type IOnChainHistoryTxToken,
} from '@onekeyhq/shared/types/history';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { getTransactionTypeFromTxInfo } from './utils';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  INativeAmountInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type { Type } from '@polkadot/types';
import type { Args, TypeRegistry } from '@substrate/txwrapper-polkadot';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

export default class VaultDot extends VaultBase {
  override coreApi = coreChainApi.dot.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkInfo, networkId, externalAccountAddress } = params;

    let address = account.address || externalAccountAddress || '';
    const baseAddress = address;
    if (account.pub) {
      const pubKeyBytes = bufferUtils.hexToBytes(
        hexUtils.stripHexPrefix(account.pub),
      );
      address = encodeAddress(pubKeyBytes, +networkInfo.addressPrefix);
    }

    return {
      networkId,
      normalizedAddress: baseAddress,
      displayAddress: address,
      address,
      baseAddress,
      isValid: true,
      allowEmptyAddress: false,
    };
  }

  private async _getTxBaseInfo(): Promise<{
    blockHash: string;
    blockNumber: number;
    genesisHash: string;
    metadataRpc: `0x${string}`;
    specName: string;
    specVersion: number;
    transactionVersion: number;
    registry: TypeRegistry;
  }> {
    const [
      { specName, specVersion, transactionVersion },
      blockHash,
      genesisHash,
      { block },
      metadataRpc,
    ] = (await this.backgroundApi.serviceAccountProfile.sendProxyRequest({
      networkId: this.networkId,
      body: [
        {
          route: 'rpc',
          params: {
            method: 'state_getRuntimeVersion',
            params: [],
          },
        },
        {
          route: 'rpc',
          params: {
            method: 'chain_getBlockHash',
            params: [],
          },
        },
        {
          route: 'rpc',
          params: {
            method: 'chain_getBlockHash',
            params: [0],
          },
        },
        {
          route: 'rpc',
          params: {
            method: 'chain_getBlock',
            params: [],
          },
        },
        {
          route: 'rpc',
          params: {
            method: 'state_getMetadata',
            params: [],
          },
        },
      ],
    })) as [
      { specName: string; specVersion: number; transactionVersion: number },
      string,
      string,
      { block: { header: { number: number } } },
      `0x${string}`,
    ];
    const info = {
      metadataRpc,
      specName: specName as 'polkadot',
      specVersion,
      chainName: await this.getNetworkChainId(),
    };
    const registry = getRegistry(info);
    return {
      ...info,
      blockNumber: block.header.number,
      transactionVersion,
      blockHash,
      genesisHash,
      registry,
    };
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTx> {
    const { transfersInfo } = params;
    if (!transfersInfo || !transfersInfo[0].to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const networkInfo = await this.getNetworkInfo();

    const { to, amount, tokenInfo, keepAlive } = transfersInfo[0];
    const from = await this.getAccountAddress();
    const toAccountId = decodeAddress(
      to,
      true,
      networkInfo?.addressPrefix ? +networkInfo.addressPrefix : 0,
    );

    const chainId = await this.getNetworkChainId();
    let toAccount = { id: to };
    if (chainId === 'joystream') {
      toAccount = hexUtils.addHexPrefix(
        bufferUtils.bytesToHex(toAccountId),
      ) as unknown as { id: string };
    }

    let amountValue;

    const network = await this.getNetwork();
    const txBaseInfo = await this._getTxBaseInfo();

    const account =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId: this.networkId,
        accountAddress: from,
      });

    const info = {
      ...txBaseInfo,
      address: from,
      eraPeriod: 64,
      nonce: account.nonce ?? 0,
      tip: 0,
    };

    const option = {
      metadataRpc: txBaseInfo.metadataRpc,
      registry: txBaseInfo.registry,
    };

    let unsigned;
    if (tokenInfo && tokenInfo?.address && !tokenInfo.isNative) {
      amountValue = new BigNumber(amount)
        .shiftedBy(tokenInfo.decimals)
        .toFixed(0);
      if (keepAlive) {
        unsigned = methods.assets.transferKeepAlive(
          {
            id: parseInt(tokenInfo.address),
            target: to,
            amount: amountValue,
          },
          info,
          option,
        );
      } else {
        unsigned = methods.assets.transfer(
          {
            id: parseInt(tokenInfo.address),
            target: to,
            amount: amountValue,
          },
          info,
          option,
        );
      }
    } else {
      amountValue = new BigNumber(amount)
        .shiftedBy(network.decimals)
        .toFixed(0);
      if (keepAlive) {
        unsigned = methods.balances.transferKeepAlive(
          {
            value: amountValue,
            dest: toAccount,
          },
          info,
          option,
        );
      } else if (chainId === 'joystream') {
        unsigned = methods.balances.transfer(
          {
            value: amountValue,
            dest: toAccount,
          },
          info,
          option,
        );
      } else {
        unsigned = methods.balances.transferAllowDeath(
          {
            value: amountValue,
            dest: toAccount,
          },
          info,
          option,
        );
      }
    }

    return {
      ...unsigned,
      specName: txBaseInfo.specName,
      chainName: network.name,
    };
  }

  private async _getMetadataRpc(): Promise<`0x${string}`> {
    const [res] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<`0x${string}`>(
        {
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'state_getMetadata',
                params: [],
              },
            },
          ],
        },
      );
    return res;
  }

  private async _getRegistry(params: {
    metadataRpc?: `0x${string}`;
    specVersion?: string;
    specName?: string;
  }): Promise<TypeRegistry> {
    const network = await this.getNetwork();

    let metadataRpcHex: `0x${string}`;
    if (isNil(params.metadataRpc) || isEmpty(params.metadataRpc)) {
      metadataRpcHex = await this._getMetadataRpc();
    } else {
      metadataRpcHex = params.metadataRpc;
    }

    let specVersion: number;
    let specName: string;
    if (
      !params.specVersion ||
      isEmpty(params.specVersion) ||
      !params.specName ||
      isEmpty(params.specName)
    ) {
      const [res] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
          specName: string;
          specVersion: number;
        }>({
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'state_getRuntimeVersion',
                params: [],
              },
            },
          ],
        });
      specVersion = res.specVersion;
      specName = res.specName;
    } else {
      specVersion = +numberUtils.hexToDecimal(
        hexUtils.addHexPrefix(params.specVersion),
      );
      specName = params.specName;
    }

    return getRegistry({
      chainName: network.name,
      specName: specName as 'polkadot',
      specVersion,
      metadataRpc: metadataRpcHex,
    });
  }

  private async _decodeUnsignedTx(unsigned: IEncodedTxDot) {
    const registry = await this._getRegistry(unsigned);

    let { metadataRpc } = unsigned;
    if (!metadataRpc) {
      metadataRpc = await this._getMetadataRpc();
    }
    const decodedUnsigned = decode(unsigned, {
      metadataRpc,
      registry,
    });

    return decodedUnsigned;
  }

  private async _getAddressByTxArgs(args: Args): Promise<string> {
    const chainId = await this.getNetworkChainId();
    if (chainId === 'joystream') {
      return args.dest as string;
    }
    return (args.dest as { id: string }).id;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;

    const encodedTx = unsignedTx.encodedTx as IEncodedTxDot;

    const account = await this.getAccount();

    const decodeUnsignedTx = await this._decodeUnsignedTx(encodedTx);

    let action: IDecodedTxAction | null = null;
    const actionType = getTransactionTypeFromTxInfo(decodeUnsignedTx);

    if (actionType === EDecodedTxActionType.ASSET_TRANSFER) {
      const from = account.address;
      let to = '';
      let amount = '';

      const networkInfo = await this.getNetworkInfo();
      let assetId = '';
      if (decodeUnsignedTx.assetId) {
        if (isObject(decodeUnsignedTx.assetId)) {
          const assetIdInst = decodeUnsignedTx.assetId as Type;
          if (!assetIdInst.isEmpty) {
            assetId = assetIdInst.toHex();
          }
        } else {
          assetId = decodeUnsignedTx.assetId.toString();
        }
      }
      const tokenInfo = await this.backgroundApi.serviceToken.getToken({
        networkId: this.networkId,
        tokenIdOnNetwork: assetId || (networkInfo.nativeTokenAddress ?? ''),
        accountAddress: account.address,
      });

      const { value: tokenAmount } = decodeUnsignedTx.method.args;
      to = await this._getAddressByTxArgs(decodeUnsignedTx.method.args);

      amount = tokenAmount?.toString() ?? '0';

      const transferAction: IDecodedTxTransferInfo = {
        from,
        to,
        amount: new BigNumber(amount).shiftedBy(-tokenInfo.decimals).toFixed(),
        icon: tokenInfo.logoURI ?? '',
        name: tokenInfo.symbol,
        symbol: tokenInfo.symbol,
        tokenIdOnNetwork: tokenInfo.address,
        isNFT: false,
        isNative: tokenInfo.symbol === networkInfo.nativeTokenAddress,
      };

      action = await this.buildTxTransferAssetAction({
        from,
        to,
        transfers: [transferAction],
      });
    } else {
      action = {
        type: EDecodedTxActionType.UNKNOWN,
        direction: EDecodedTxDirection.OTHER,
        unknownAction: {
          from: account.address,
          to: '',
        },
      };
    }

    const result: IDecodedTx = {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: decodeUnsignedTx.nonce,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: encodedTx?.feeInfo,
      extraInfo: null,
      encodedTx,
    };

    return result;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = (params.encodedTx ??
      (await this.buildEncodedTx(params))) as IEncodedTxDot;
    if (encodedTx) {
      if (!encodedTx.metadataRpc) {
        encodedTx.metadataRpc = await this._getMetadataRpc();
      }
      return {
        encodedTx,
      };
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, nativeAmountInfo } = params;
    let encodedTx = unsignedTx.encodedTx as IEncodedTxDot;
    if (params.nonceInfo) {
      encodedTx.nonce = hexUtils.hexlify(params.nonceInfo.nonce, {
        hexPad: 'left',
      }) as `0x${string}`;
    }

    // send max amount
    if (nativeAmountInfo) {
      const decodeUnsignedTx = await this._decodeUnsignedTx(encodedTx);
      const type = getTransactionTypeFromTxInfo(decodeUnsignedTx);
      if (type === EDecodedTxActionType.ASSET_TRANSFER) {
        const txBaseInfo = await this._getTxBaseInfo();
        const from = await this.getAccountAddress();

        const info = {
          ...txBaseInfo,
          address: from,
          eraPeriod: 64,
          nonce: decodeUnsignedTx.nonce ?? 0,
          tip: 0,
        };

        const option = {
          metadataRpc: txBaseInfo.metadataRpc,
          registry: txBaseInfo.registry,
        };

        const network = await this.getNetwork();
        const amountValue = new BigNumber(nativeAmountInfo.maxSendAmount ?? '0')
          .shiftedBy(network.decimals)
          .toFixed(0);
        const dest = decodeUnsignedTx.method.args.dest as { id: string };

        let tx;
        if (decodeUnsignedTx.method?.name?.indexOf('KeepAlive') !== -1) {
          tx = methods.balances.transferKeepAlive(
            {
              value: amountValue,
              dest,
            },
            info,
            option,
          );
        } else {
          tx = methods.balances.transferAll(
            {
              dest,
              keepAlive: false,
            },
            info,
            option,
          );
        }
        encodedTx = {
          ...tx,
          specName: txBaseInfo.specName,
          chainName: network.name,
        };
      }
    }

    return {
      encodedTx,
      feeInfo: params.feeInfo,
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const networkInfo = await this.getNetworkInfo();
    let isValid = true;
    try {
      encodeAddress(
        decodeAddress(address, false, +networkInfo.addressPrefix),
        +networkInfo.addressPrefix,
      );
    } catch (error) {
      isValid = false;
    }
    return {
      isValid,
      normalizedAddress: address,
      displayAddress: address,
    };
  }

  override async validateXpub(xpub: string): Promise<IXpubValidation> {
    return {
      isValid: false,
    };
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return this.baseGetPrivateKeyFromImported(params);
  }

  override async validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return {
      isValid: false,
    };
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return this.baseValidatePrivateKey(privateKey);
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTxDot | undefined;
  }) {
    if (!encodedTx) {
      return { encodedTx };
    }

    const fakeSignature = Buffer.concat([
      Buffer.from([0x01]),
      Buffer.alloc(64).fill(0x42),
    ]);
    const tx = await serializeSignedTransaction(
      encodedTx,
      fakeSignature.toString('hex'),
    );
    return {
      encodedTx: bufferUtils
        .toBuffer(tx)
        .toString('base64') as unknown as IEncodedTx,
    };
  }

  private _getMinAmount = memoizee(
    async ({
      accountAddress,
      withBalance,
    }: {
      accountAddress: string;
      withBalance?: boolean;
    }) => {
      const [minAmountStr] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<string>(
          {
            networkId: this.networkId,
            body: [
              {
                route: 'consts',
                params: {
                  method: 'balances.existentialDeposit',
                  params: [],
                },
              },
            ],
          },
        );
      const minAmount = new BigNumber(minAmountStr);
      const account = withBalance
        ? await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
            networkId: this.networkId,
            accountAddress,
            withNonce: false,
            withNetWorth: true,
          })
        : {
            balance: '0',
          };
      const balance = new BigNumber(account.balance ?? 0);
      return {
        minAmount,
        balance,
      };
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  override async validateSendAmount({
    to,
    amount,
  }: {
    to: string;
    amount: string;
  }): Promise<boolean> {
    if (isNil(amount) || isEmpty(amount) || isEmpty(to)) {
      return true;
    }
    const network = await this.getNetwork();

    const sendAmount = new BigNumber(amount).shiftedBy(network.decimals);
    const { minAmount, balance } = await this._getMinAmount({
      accountAddress: to,
      withBalance: true,
    });

    if (balance.plus(sendAmount).lt(minAmount)) {
      throw new InvalidTransferValue({
        key: ETranslations.form_amount_recipient_activate,
        info: {
          amount: minAmount.shiftedBy(-network.decimals).toFixed(),
          unit: network.symbol,
        },
      });
    }
    return true;
  }

  override async precheckUnsignedTx(params: {
    unsignedTx: IUnsignedTxPro;
    nativeAmountInfo?: INativeAmountInfo;
  }): Promise<boolean> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxDot;
    const decodedUnsignedTx = await this._decodeUnsignedTx(encodedTx);
    const actionType = getTransactionTypeFromTxInfo(decodedUnsignedTx);

    if (actionType === EDecodedTxActionType.ASSET_TRANSFER) {
      const args = decodedUnsignedTx.method.args as {
        dest: string;
        value: string;
      };
      const toAddress = await this._getAddressByTxArgs(args);
      if (toAddress === encodedTx.address) {
        return true;
      }

      let { minAmount, balance } = await this._getMinAmount({
        accountAddress: encodedTx.address,
        withBalance: !params.nativeAmountInfo?.maxSendAmount,
      });
      if (params.nativeAmountInfo?.maxSendAmount) {
        balance = new BigNumber(params.nativeAmountInfo?.maxSendAmount ?? '0');
      }
      const tokenAmount = new BigNumber(args.value);
      const gasLimit = new BigNumber(encodedTx.feeInfo?.gas?.gasLimit ?? '0');
      const gasPrice = new BigNumber(encodedTx.feeInfo?.gas?.gasPrice ?? '0');
      const fee = gasLimit.times(gasPrice);
      const leftAmount = balance.minus(tokenAmount).minus(fee);

      if (leftAmount.lt(minAmount) && leftAmount.gt(0)) {
        const network = await this.getNetwork();
        throw new BalanceLowerMinimum({
          info: {
            amount: minAmount.shiftedBy(-network.decimals).toFixed(),
            symbol: network.symbol,
          },
        });
      }
    }

    return true;
  }

  override async buildHistoryTransferAction({
    tx,
    tokens,
    nfts,
  }: {
    tx: IOnChainHistoryTx;
    tokens: Record<string, IOnChainHistoryTxToken>;
    nfts: Record<string, IAccountNFT>;
  }): Promise<IDecodedTxAction> {
    let to = tx.to;
    let sends = tx.sends;
    let receives = tx.receives;
    if (!tx.to) {
      const confirmedTxs =
        await this.backgroundApi.serviceHistory.getAccountLocalHistoryConfirmedTxs(
          {
            networkId: this.networkId,
            accountAddress: tx.from,
          },
        );
      let localTx = confirmedTxs.find((item) => item.decodedTx.txid === tx.tx);
      if (!localTx) {
        const pendingTxs =
          await this.backgroundApi.serviceHistory.getAccountLocalHistoryPendingTxs(
            {
              networkId: this.networkId,
              accountAddress: tx.from,
            },
          );
        localTx = pendingTxs.find((item) => item.decodedTx.txid === tx.tx);
      }
      if (localTx && localTx.decodedTx.actions[0].assetTransfer) {
        const assetTransfer = localTx.decodedTx.actions[0].assetTransfer;
        to = assetTransfer.to;
        sends = assetTransfer.sends.map((send) => ({
          ...send,
          label: send.label || '',
          token: send.tokenIdOnNetwork,
          type: EOnChainHistoryTransferType.Transfer,
        }));
        receives = assetTransfer.receives.map((receive) => ({
          ...receive,
          label: receive.label || '',
          token: receive.tokenIdOnNetwork,
          type: EOnChainHistoryTransferType.Transfer,
        }));
      }
    }
    return {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: {
        from: tx.from,
        to,
        label: tx.label,
        sends: sends.map((send) =>
          this.buildHistoryTransfer({
            transfer: send,
            tokens,
            nfts,
          }),
        ),
        receives: receives.map((receive) =>
          this.buildHistoryTransfer({
            transfer: receive,
            tokens,
            nfts,
          }),
        ),
      },
    };
  }
}
