import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { convertDecodedTxActionsToSignatureConfirmTxDisplay } from '@onekeyhq/shared/src/utils/txActionUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IParseTransactionResp } from '@onekeyhq/shared/types/signatureConfirm';
import type {
  IDecodedTx,
  IParseTransactionParams,
  ISendTxBaseParams,
} from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IBuildDecodedTxParams } from '../vaults/types';

@backgroundClass()
class ServiceSend extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async buildDecodedTx(
    params: ISendTxBaseParams & IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const {
      networkId,
      accountId,
      accountAddress,
      unsignedTx,
      feeInfo,
      transferPayload,
      saveToLocalHistory,
    } = params;

    let parsedTx;

    // try to parse tx through background api
    try {
      parsedTx = await this.parseTransaction({
        networkId,
        accountId,
        accountAddress,
        encodedTx: unsignedTx.encodedTx,
      });
    } catch (e) {
      console.log('parse tx through api failed', e);
    }

    const vault = await vaultFactory.getVault({ networkId, accountId });
    const decodedTx = await vault.buildDecodedTx({
      unsignedTx,
      transferPayload,
      saveToLocalHistory,
    });

    if (feeInfo) {
      decodedTx.totalFeeInNative =
        feeInfo.totalNativeForDisplay ?? feeInfo.totalNative;
      decodedTx.totalFeeFiatValue =
        feeInfo.totalFiatForDisplay ?? feeInfo.totalFiat;
      decodedTx.feeInfo = feeInfo.feeInfo;
    }

    if (parsedTx && parsedTx.display) {
      decodedTx.txDisplay = parsedTx.display;
    } else {
      // convert decodedTx actions to signatureConfirm txDisplay as fallback
      decodedTx.txDisplay = convertDecodedTxActionsToSignatureConfirmTxDisplay({
        decodedTx,
      });
    }

    return decodedTx;
  }

  @backgroundMethod()
  async parseTransaction(params: IParseTransactionParams) {
    const { accountId, networkId, encodedTx } = params;
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    let accountAddress = params.accountAddress;
    if (!accountAddress) {
      accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
    }

    const { encodedTx: encodedTxToParse } =
      await vault.buildParseTransactionParams({
        encodedTx,
      });

    const client = await this.backgroundApi.serviceGas.getClient(
      EServiceEndpointEnum.Wallet,
    );
    const resp = await client.post<{ data: IParseTransactionResp }>(
      '/wallet/v1/account/parse-transaction',
      {
        networkId,
        accountAddress,
        encodedTx: encodedTxToParse,
      },
      {
        headers:
          await this.backgroundApi.serviceAccountProfile._getWalletTypeHeader({
            accountId,
          }),
      },
    );
    return resp.data.data;
  }
}

export default ServiceSend;
