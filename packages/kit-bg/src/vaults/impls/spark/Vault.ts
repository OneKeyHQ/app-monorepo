import { isNil } from 'lodash';

import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isReusableLightningRecipient } from '@onekeyhq/shared/src/utils/lnUrlUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IEstimateGasParams,
  IServerEstimateFeeResponse,
} from '@onekeyhq/shared/types/fee';
import type {
  IServerFetchAccountHistoryDetailParams,
  IServerFetchAccountHistoryDetailResp,
} from '@onekeyhq/shared/types/history';
import type { IEncodedTxLightningSpark } from '@onekeyhq/shared/types/lightning';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringHd } from './KeyringHd';
import { withLocalHistoryFee } from './sdkSpark/historyFee';
import {
  buildSparkInvoiceEncodedTx,
  isSparkPayableInvoice,
} from './sdkSpark/invoicePayment';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: undefined,
    imported: undefined,
    watching: undefined,
    external: undefined,
  };

  // Like the custodial Lightning network, the account shows no address and
  // receives through invoices; API calls read the Spark address from
  // normalizedAddress.
  override buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    return Promise.resolve({
      networkId,
      normalizedAddress: account.address,
      displayAddress: '',
      address: '',
      baseAddress: '',
      isValid: !!account.address,
      allowEmptyAddress: true,
    });
  }

  override async getAccountAddress(): Promise<string> {
    return (await this.getAccount()).addressDetail.normalizedAddress;
  }

  // Phase 1 sends pay BOLT11 invoices; one without an amount pays the amount
  // entered on the amount page. The OneKey lightning service decodes the
  // invoice; the Breez SDK pays it in broadcastTransaction.
  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxLightningSpark> {
    const { transfersInfo } = params;
    if (!transfersInfo || transfersInfo.length !== 1) {
      throw new OneKeyInternalError('Lightning sends one payment at a time');
    }
    const {
      to: input,
      amount: enteredAmountSats,
      lightningAddress,
    } = transfersInfo[0];
    const decoded =
      await this.backgroundApi.serviceLightning.decodeInvoiceByServer(input);
    return {
      ...buildSparkInvoiceEncodedTx({ input, decoded, enteredAmountSats }),
      ...(lightningAddress ? { lightningAddress } : {}),
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxLightningSpark;
    const network = await this.getNetwork();
    const account = await this.getAccount();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      accountId: this.accountId,
      networkId: this.networkId,
      tokenIdOnNetwork: '',
    });
    const to =
      encodedTx.lightningAddress ??
      accountUtils.shortenAddress({
        address: encodedTx.invoice,
        leadingLength: 44,
        trailingLength: 33,
      });

    let action: IDecodedTxAction = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: { from: account.name, to },
    };
    if (nativeToken) {
      const amount = encodedTx.amountSats;
      action = {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: {
          from: account.name,
          to,
          sends: [
            {
              from: account.name,
              to,
              isNative: true,
              tokenIdOnNetwork: '',
              name: nativeToken.name,
              icon: nativeToken.logoURI ?? '',
              amount,
              symbol: network.symbol,
            },
          ],
          receives: [],
          nativeAmount: amount,
          nativeAmountValue: amount,
        },
      };
    }

    return {
      txid: '',
      owner: account.name,
      signer: '',
      nonce: 0,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      encodedTx,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);
    return { encodedTx, transfersInfo: params.transfersInfo };
  }

  // The fee the user approved on the confirm page caps the fee of the payment
  // the SDK sends.
  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo } = params;
    const baseFee = feeInfo?.common?.baseFee;
    if (isNil(baseFee)) {
      return unsignedTx;
    }
    const encodedTx: IEncodedTxLightningSpark = {
      ...(unsignedTx.encodedTx as IEncodedTxLightningSpark),
      maxFeeSats: baseFee,
    };
    return { ...unsignedTx, encodedTx };
  }

  // The Spark service provider quotes the Lightning fee through the SDK; the
  // OneKey server has no fee data for this network.
  override async estimateFee(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse> {
    const { feeSats } =
      await this.backgroundApi.serviceLightningSpark.quoteInvoicePayment({
        accountId: params.accountId,
        networkId: this.networkId,
        encodedTx: params.encodedTx as IEncodedTxLightningSpark,
      });
    const network = await this.getNetwork();
    return {
      data: {
        data: {
          isEIP1559: false,
          baseFee: feeSats,
          feeDecimals: network.feeMeta.decimals,
          feeSymbol: network.feeMeta.symbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
        },
      },
    };
  }

  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const { signedTx } = params;
    const { paymentId } =
      await this.backgroundApi.serviceLightningSpark.payInvoice({
        accountId: this.accountId,
        networkId: this.networkId,
        encodedTx: signedTx.encodedTx as IEncodedTxLightningSpark,
      });
    return { ...signedTx, txid: paymentId };
  }

  override async fetchAccountHistoryDetail(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IServerFetchAccountHistoryDetailResp> {
    const resp = await super.fetchAccountHistoryDetail(params);
    const { networkId, txid, accountAddress, xpub } = params;
    if (!accountAddress && !xpub) {
      return resp;
    }
    const localTx =
      await this.backgroundApi.simpleDb.localHistory.getLocalHistoryTxById({
        networkId,
        accountAddress,
        xpub,
        historyId: accountUtils.buildLocalHistoryId({
          networkId,
          txid,
          accountAddress: accountAddress ?? '',
          xpub,
        }),
      });
    return withLocalHistoryFee({ resp, localTx });
  }

  // A recipient is a BOLT11 invoice. Spark addresses are not a send target.
  override async validateAddress(address: string): Promise<IAddressValidation> {
    const valid = {
      isValid: true,
      normalizedAddress: address,
      displayAddress: address,
    };
    // LNURL and Lightning addresses are recognized by format only: the send
    // flow does not pay them yet and never hands them to the Breez SDK.
    if (isReusableLightningRecipient(address)) {
      return valid;
    }
    if (isSparkPayableInvoice(address)) {
      try {
        await this.backgroundApi.serviceLightning.decodeInvoiceByServer(
          address,
        );
        return valid;
      } catch {
        // Not an invoice the lightning service can decode.
      }
    }
    return { isValid: false, normalizedAddress: '', displayAddress: '' };
  }

  override validateXpub(_xpub: string): Promise<IXpubValidation> {
    throw new NotImplemented();
  }

  override getPrivateKeyFromImported(
    _params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    throw new NotImplemented();
  }

  override validateXprvt(_xprvt: string): Promise<IXprvtValidation> {
    throw new NotImplemented();
  }

  override validatePrivateKey(
    _privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    throw new NotImplemented();
  }

  override validateGeneralInput(
    _params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    throw new NotImplemented();
  }
}
