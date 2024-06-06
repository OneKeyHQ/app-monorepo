/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  buildInputScriptBuffer,
  buildRawTx,
  buildSignatureBuffer,
  buildTxid,
  getNexaPrefix,
} from '@onekeyhq/core/src/chains/nexa/sdkNexa';
import type {
  IEncodedTxNexa,
  INexaInputSignature,
} from '@onekeyhq/core/src/chains/nexa/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

const SIGN_TYPE = 'Schnorr';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.nexa.hd;

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdUtxoAccounts(params, {
      checkIsAccountUsed: () => Promise.resolve({ isUsed: true }),
      buildAddressesInfo: async ({ usedIndexes }) => {
        const chainId = await this.getNetworkChainId();
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            showOnOnekeyFn,
          }) => {
            const paths = usedIndexes.map(
              (index) => `${pathPrefix}/${index}'/0/0`,
            );
            const bundle = paths.map((path, index) => ({
              path,
              showOnOneKey: showOnOnekeyFn(index),
              prefix: getNexaPrefix(chainId),
              scheme: SIGN_TYPE,
            }));
            const sdk = await this.getHardwareSDKInstance();
            const response = await sdk.nexaGetAddress(connectId, deviceId, {
              ...params.deviceParams.deviceCommonParams,
              bundle,
            });
            return response;
          },
        });

        const ret = [];
        const firstAddressRelPath = '0/0';
        for (const addressInfo of addressesInfo) {
          const { address, path, pub } = addressInfo;
          const formattedPath = accountUtils.formatUtxoPath(path);
          ret.push({
            address: pub,
            publicKey: pub,
            path: formattedPath,
            relPath: firstAddressRelPath,
            xpub: '',
            addresses: { [this.networkId]: address },
          });
        }
        return ret;
      },
    });
  }

  override async batchGetAddresses(params: IPrepareHardwareAccountsParams) {
    const { indexes } = params;

    const addresses = await this.baseGetDeviceAccountAddresses({
      params,
      usedIndexes: indexes,
      sdkGetAddressFn: async ({
        connectId,
        deviceId,
        pathPrefix,
        showOnOnekeyFn,
      }) => {
        const chainId = await this.getNetworkChainId();

        const paths = indexes.map((index) => `${pathPrefix}/${index}'/0/0`);
        const bundle = paths.map((path, index) => ({
          path,
          showOnOneKey: showOnOnekeyFn(index),
          prefix: getNexaPrefix(chainId),
          scheme: SIGN_TYPE,
        }));

        const sdk = await this.getHardwareSDKInstance();

        const response = await sdk.nexaGetAddress(connectId, deviceId, {
          ...params.deviceParams.deviceCommonParams,
          bundle,
        });
        return response;
      },
    });

    return addresses.map((item) => ({
      path: item.path ?? '',
      address: item.address ?? '',
    }));
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const sdk = await this.getHardwareSDKInstance();
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxNexa;
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();
    const chainId = await this.getNetworkChainId();

    const { inputSignatures, outputSignatures, signatureBuffer } =
      buildSignatureBuffer(encodedTx, dbAccount.address);

    const response = await sdk.nexaSignTransaction(connectId, deviceId, {
      ...params.deviceParams?.deviceCommonParams,
      inputs: [
        {
          path: `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`,
          prefix: getNexaPrefix(chainId),
          message: signatureBuffer.toString('hex'),
        },
      ],
    });

    if (response.success) {
      const nexaSignatures = response.payload;
      const publicKey = Buffer.from(dbAccount.address, 'hex');
      const defaultSignature = Buffer.from(nexaSignatures[0].signature, 'hex');
      const inputSigs: INexaInputSignature[] = inputSignatures.map(
        (inputSig) => ({
          ...inputSig,
          publicKey,
          signature: defaultSignature,
          scriptBuffer: buildInputScriptBuffer(publicKey, defaultSignature),
        }),
      );

      const txid = buildTxid(inputSigs, outputSignatures);
      const rawTx = buildRawTx(inputSigs, outputSignatures, 0, true);

      return {
        txid,
        rawTx: rawTx.toString('hex'),
        encodedTx,
      };
    }

    throw convertDeviceError(response.payload);
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }
}
