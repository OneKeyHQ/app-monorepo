/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  checkAddress,
  decodeAddress,
  encodeAddress,
} from '@polkadot/util-crypto';
import { decode, methods } from '@substrate/txwrapper-polkadot';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil, isObject } from 'lodash';

import { serializeSignedTransaction } from '@onekeyhq/core/src/chains/dot/sdkDot';
import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  BalanceLowerMinimum,
  InvalidTransferValue,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import { ESendPreCheckTimingEnum } from '@onekeyhq/shared/types/send';
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
import {
  getBlockInfo,
  getGenesisHash,
  getMetadataRpc,
  getMinAmount,
  getRegistry,
  getRuntimeVersion,
  getTransactionTypeFromTxInfo,
} from './utils';

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
    blockHash: `0x${string}`;
    blockNumber: number;
    genesisHash: `0x${string}`;
    metadataRpc: `0x${string}`;
    specName: string;
    specVersion: number;
    transactionVersion: number;
    registry: TypeRegistry;
  }> {
    const [
      { specName, specVersion, transactionVersion },
      genesisHash,
      metadataRpc,
      { blockHash, blockNumber },
    ] = await Promise.all([
      getRuntimeVersion(this.networkId, this.backgroundApi),
      getGenesisHash(this.networkId, this.backgroundApi),
      getMetadataRpc(this.networkId, this.backgroundApi),
      getBlockInfo(this.networkId, this.backgroundApi),
    ]);
    const info = {
      metadataRpc,
      specName: specName as 'polkadot',
      specVersion,
      chainName: await this.getNetworkChainId(),
    };
    const registry = await getRegistry(
      { ...info, networkId: this.networkId },
      this.backgroundApi,
    );
    return {
      ...info,
      blockNumber,
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

    const info = {
      ...txBaseInfo,
      address: from,
      eraPeriod: 64,
      nonce: 0,
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
      metadataRpc: '' as unknown as `0x${string}`,
    };
  }

  private async _decodeUnsignedTx(unsigned: IEncodedTxDot) {
    let { metadataRpc } = unsigned;
    if (!metadataRpc) {
      metadataRpc = await getMetadataRpc(this.networkId, this.backgroundApi);
    }
    const registry = await getRegistry(
      {
        specName: unsigned.specName,
        specVersion: unsigned.specVersion,
        metadataRpc,
        networkId: this.networkId,
      },
      this.backgroundApi,
    );

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
        accountId: this.accountId,
        networkId: this.networkId,
        tokenIdOnNetwork: assetId || (networkInfo.nativeTokenAddress ?? ''),
      });

      if (tokenInfo) {
        const { value: tokenAmount } = decodeUnsignedTx.method.args;
        to = await this._getAddressByTxArgs(decodeUnsignedTx.method.args);

        if (decodeUnsignedTx.method.name === 'transferAll') {
          const balance = new BigNumber(
            params.transferPayload?.amountToSend ?? 0,
          ).shiftedBy(tokenInfo.decimals);
          const feeInfo = unsignedTx.feeInfo;
          const fee = feeInfo
            ? new BigNumber(feeInfo.gas?.gasLimit ?? 0)
                .times(new BigNumber(feeInfo.gas?.gasPrice ?? 0))
                .shiftedBy(feeInfo.common.feeDecimals)
            : 0;
          amount = balance.minus(fee).toFixed();
        } else {
          amount = tokenAmount?.toString() ?? '0';
        }

        const transferAction: IDecodedTxTransferInfo = {
          from,
          to,
          amount: new BigNumber(amount)
            .shiftedBy(-tokenInfo.decimals)
            .toFixed(),
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
      }
    }

    if (!action) {
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
    if (params.feeInfo) {
      encodedTx.feeInfo = params.feeInfo;
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
          metadataRpc: '' as `0x${string}`,
        };
      }
    }

    if (!params.nonceInfo && !encodedTx.isFromDapp) {
      const blockInfo = await getBlockInfo(this.networkId, this.backgroundApi);
      const registry = await getRegistry(
        {
          networkId: this.networkId,
          metadataRpc: encodedTx.metadataRpc,
          specName: (encodedTx.specName ?? '') as 'polkadot',
          specVersion: +encodedTx.specVersion,
        },
        this.backgroundApi,
      );
      const era = registry.createType('ExtrinsicEra', {
        current: blockInfo.blockNumber,
        period: 64,
      });
      encodedTx = {
        ...encodedTx,
        blockHash: blockInfo.blockHash,
        blockNumber: blockInfo.blockNumber as unknown as `0x${string}`,
        era: era.toHex(),
      };
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
      const [result] = checkAddress(address, +networkInfo.addressPrefix);
      isValid = result;
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
      {
        ...encodedTx,
        metadataRpc: await getMetadataRpc(this.networkId, this.backgroundApi),
      },
      fakeSignature.toString('hex'),
    );
    return {
      encodedTx: bufferUtils
        .toBuffer(tx)
        .toString('base64') as unknown as IEncodedTx,
    };
  }

  private _getBalance = memoizee(
    async (address: string) => {
      const account =
        await this.backgroundApi.serviceAccountProfile.fetchAccountInfo({
          accountId: this.accountId,
          networkId: this.networkId,
          accountAddress: address,
          withNetWorth: true,
        });
      return new BigNumber(account.balance ?? 0);
    },
    { promise: true, maxAge: 10000 },
  );

  override async validateSendAmount({
    to,
    amount,
  }: {
    to: string;
    amount: string;
  }): Promise<boolean> {
    // preload registry
    void getRegistry(
      {
        networkId: this.networkId,
      },
      this.backgroundApi,
    );
    if (isNil(amount) || isEmpty(amount) || isEmpty(to)) {
      return true;
    }
    const network = await this.getNetwork();

    const sendAmount = new BigNumber(amount).shiftedBy(network.decimals);
    const minAmount = await getMinAmount(this.networkId, this.backgroundApi);
    const balance = await this._getBalance(to);

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
    precheckTiming: ESendPreCheckTimingEnum;
    feeInfo?: IFeeInfoUnit;
  }): Promise<boolean> {
    if (params.precheckTiming !== ESendPreCheckTimingEnum.Confirm) {
      return true;
    }
    if (params.nativeAmountInfo?.maxSendAmount) {
      return true;
    }
    const { unsignedTx, feeInfo } = params;
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

      const minAmount = await getMinAmount(this.networkId, this.backgroundApi);
      const balance = !params.nativeAmountInfo?.maxSendAmount
        ? await this._getBalance(encodedTx.address)
        : new BigNumber(0);
      const tokenAmount = new BigNumber(args.value);
      const gasLimit = new BigNumber(feeInfo?.gas?.gasLimit ?? '0');
      const gasPrice = new BigNumber(feeInfo?.gas?.gasPrice ?? '0');
      const fee = gasLimit
        .times(gasPrice)
        .plus(new BigNumber(feeInfo?.common.baseFee ?? '0'))
        .shiftedBy(feeInfo?.common.feeDecimals ?? 0);
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
}
