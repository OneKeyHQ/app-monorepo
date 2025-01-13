import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  convertAddressToSignatureConfirmAddress,
  convertDecodedTxActionsToSignatureConfirmTxDisplayComponents,
  convertDecodedTxActionsToSignatureConfirmTxDisplayTitle,
  convertNetworkToSignatureConfirmNetwork,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import {
  EParseTxComponentType,
  EParseTxType,
  type IParseTransactionResp,
} from '@onekeyhq/shared/types/signatureConfirm';
import type {
  IDecodedTx,
  IParseTransactionParams,
  ISendTxBaseParams,
} from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IBuildDecodedTxParams } from '../vaults/types';

@backgroundClass()
class ServiceSignatureConfirm extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async buildDecodedTxs(
    params: ISendTxBaseParams &
      Omit<IBuildDecodedTxParams, 'unsignedTx'> & {
        unsignedTxs: IUnsignedTxPro[];
      },
  ) {
    const { unsignedTxs, accountId, networkId, ...rest } = params;

    let accountAddress = params.accountAddress;
    if (!accountAddress) {
      accountAddress =
        await this.backgroundApi.serviceAccount.getAccountAddressForApi({
          accountId,
          networkId,
        });
    }
    const isMultiTxs = unsignedTxs.length > 1;
    const r = await Promise.all(
      params.unsignedTxs.map((unsignedTx) =>
        this.buildDecodedTx({
          ...rest,
          accountId,
          networkId,
          accountAddress,
          unsignedTx,
          isMultiTxs,
        }),
      ),
    );

    if (r[0] && r[0].txDisplay && r[0].isLocalParsed) {
      // add network and account info as leading components
      r[0].txDisplay.components.unshift({
        type: EParseTxComponentType.Divider,
      });

      r[0].txDisplay.components.unshift(
        convertAddressToSignatureConfirmAddress({
          address: accountAddress,
        }),
      );

      r[0].txDisplay.components.unshift(
        convertNetworkToSignatureConfirmNetwork({
          networkId,
        }),
      );

      r[0].txDisplay.title =
        convertDecodedTxActionsToSignatureConfirmTxDisplayTitle({
          decodedTxs: r,
          unsignedTxs: params.unsignedTxs,
        });
    }

    return r;
  }

  @backgroundMethod()
  async buildDecodedTx(
    params: ISendTxBaseParams &
      IBuildDecodedTxParams & {
        isMultiTxs?: boolean;
      },
  ): Promise<IDecodedTx> {
    const {
      networkId,
      accountId,
      accountAddress,
      unsignedTx,
      feeInfo,
      transferPayload,
      saveToLocalHistory,
      isMultiTxs,
    } = params;

    let parsedTx: IParseTransactionResp | null = null;

    // try to parse tx through background api
    // multi txs not supported by api for now, will support in future versions
    if (!isMultiTxs) {
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
    }

    if (
      parsedTx &&
      (unsignedTx.stakingInfo || unsignedTx.swapInfo) &&
      parsedTx?.type === EParseTxType.Unknown
    ) {
      parsedTx = null;
    }

    const vault = await vaultFactory.getVault({ networkId, accountId });
    const decodedTx = await vault.buildDecodedTx({
      unsignedTx,
      transferPayload,
      saveToLocalHistory,
      isToContract: parsedTx?.parsedTx?.to?.isContract,
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
      decodedTx.txABI = parsedTx.parsedTx?.data;
    } else {
      // convert decodedTx actions to signatureConfirm txDisplay as fallback
      const txDisplayComponents =
        convertDecodedTxActionsToSignatureConfirmTxDisplayComponents({
          decodedTx,
          isMultiTxs,
          unsignedTx,
        });

      decodedTx.txDisplay = {
        title: '',
        components: txDisplayComponents,
        alerts: [],
      };
      decodedTx.isLocalParsed = true;
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

export default ServiceSignatureConfirm;
