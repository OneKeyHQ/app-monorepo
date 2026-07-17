// cspell:ignore PAYTOCHANGE
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Transaction } from '@onekeyfe/kaspa-core-lib';

import {
  EKaspaSignType,
  MAX_BLOCK_SIZE,
  MAX_ORPHAN_TX_MASS,
  SignatureType,
  SigningMethodType,
  publicKeyFromX,
  toTransaction,
} from '@onekeyhq/core/src/chains/kaspa/sdkKaspa';
import sdkWasm from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/sdk';
import type { IEncodedTxKaspa } from '@onekeyhq/core/src/chains/kaspa/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  EAddressEncodings,
  type ICoreApiGetAddressItem,
  type ISignedMessagePro,
  type ISignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import type Vault from './Vault';
import type { IKaspaRefTransaction } from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type {
  AllNetworkAddressParams,
  KaspaSignTransactionParams,
} from '@onekeyfe/hd-core';

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.kaspa.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'kaspa';

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    const chainId = await this.getNetworkChainId();
    return {
      network: this.hwSdkNetwork,
      path: params.path,
      showOnOneKey: false,
      prefix: chainId,
      useTweak: params.addressEncoding !== EAddressEncodings.KASPA_ORG,
    };
  }

  override prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareHdNormalAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const addressesInfo = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({
            connectId,
            deviceId,
            pathPrefix,
            template,
            showOnOnekeyFn,
          }) => {
            const buildFullPath = (p: { index: number }) =>
              accountUtils.buildPathFromTemplate({
                template,
                index: p.index,
              });

            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              buildPath: buildFullPath,
              buildResultAccount: ({ account }) => ({
                path: account.path,
                address: account.payload?.address || '',
                __hwExtraInfo__: undefined,
              }),
              hwSdkNetwork: this.hwSdkNetwork,
              useTweak:
                params.deriveInfo.addressEncoding !==
                EAddressEncodings.KASPA_ORG,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }

            throw new OneKeyLocalError('use sdk allNetworkGetAddress instead');

            // const sdk = await this.getHardwareSDKInstance();
            // const chainId = await this.getNetworkChainId();
            // const response = await sdk.kaspaGetAddress(connectId, deviceId, {
            //   ...params.deviceParams.deviceCommonParams,
            //   bundle: usedIndexes.map((index, arrIndex) => ({
            //     path: `${pathPrefix}/${index}`,
            //     showOnOneKey: showOnOnekeyFn(arrIndex),
            //     prefix: chainId,
            //     scheme: EKaspaSignType.Schnorr,
            //   })),
            // });
            // return response;
          },
        });
        const ret: ICoreApiGetAddressItem[] = [];
        for (const addressInfo of addressesInfo) {
          const { address, path, __hwExtraInfo__ } = addressInfo;
          const item: ICoreApiGetAddressItem = {
            address,
            path,
            publicKey: '',
            __hwExtraInfo__,
          };
          ret.push(item);
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const sdk = await this.getHardwareSDKInstance({
      connectId: params.deviceParams?.dbDevice?.connectId || '',
    });
    const encodedTx = unsignedTx.encodedTx as IEncodedTxKaspa;
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const dbAccount = await this.vault.getAccount();
    const chainId = await this.getNetworkChainId();
    const addressEncoding = await this.vault.getAddressEncoding();

    if (unsignedTx.isKRC20RevealTx) {
      if (!encodedTx.commitScriptHex) {
        throw new OneKeyLocalError('commitScriptHex is required');
      }
      const api = await sdkWasm.getKaspaApi();
      const network = await this.getNetwork();
      const unSignTx = await api.buildUnsignedTxForHardware({
        encodedTx,
        isTestnet: !!network.isTestnet,
        accountAddress: dbAccount.address,
        path: dbAccount.path,
        chainId,
      });

      const response = await sdk.kaspaSignTransaction(connectId, deviceId, {
        ...params.deviceParams?.deviceCommonParams,
        ...unSignTx,
        useTweak: addressEncoding !== EAddressEncodings.KASPA_ORG,
      });

      if (response.success) {
        const signatures = response.payload;

        const rawTx = await api.signRevealTransactionHardware({
          accountAddress: dbAccount.address,
          encodedTx,
          isTestnet: !!network.isTestnet,
          signatures,
        });

        return {
          txid: '',
          rawTx,
          encodedTx,
        };
      }
      throw convertDeviceError(response.payload);
    }

    const txn = toTransaction(encodedTx);

    const massAndSize = txn.getMassAndSize();
    if (
      massAndSize.mass > MAX_ORPHAN_TX_MASS ||
      massAndSize.txSize > MAX_BLOCK_SIZE
    ) {
      throw new OneKeyInternalError(
        `Transaction size is too large, please try to reduce the amount of the transaction. UTXO Count: ${txn?.inputs?.length}`,
      );
    }
    // Collect previous transactions (refTxs) so the device can verify each input's
    // amount/script. Any failure or incomplete coverage → skip refTxs and
    // blind-sign (fallback); log it so a later "signing degraded / no on-device
    // verification" report can be traced to the refTx fetch rather than the tx.
    const prevTxids = Array.from(
      new Set(encodedTx.inputs.map((i) => i.txid)),
    ).filter(Boolean);
    let refTxs: IKaspaRefTransaction[] | undefined;
    try {
      const devSettings =
        await this.backgroundApi.serviceDevSetting.getDevSetting();
      if (
        devSettings.enabled &&
        devSettings.settings?.mockKaspaRefTxFetchFailed
      ) {
        throw new OneKeyLocalError(
          'mock kaspa refTx fetch failed (dev setting)',
        );
      }
      const built = await (this.vault as Vault).collectRefTxsByApi(prevTxids);
      // Require every input's prev tx; a partial set makes the device request a
      // missing prev-tx mid-stream and fail.
      const covered = new Set(built.map((t) => t.txId.toLowerCase()));
      if (!prevTxids.every((t) => covered.has(t.toLowerCase()))) {
        throw new OneKeyLocalError(
          `incomplete refTxs: got ${built.length} of ${prevTxids.length}`,
        );
      }
      refTxs = built;
    } catch (e) {
      defaultLogger.transaction.send.refTxFetchFailed({
        network: this.networkId,
        error: e instanceof Error ? e.message : String(e),
      });
      refTxs = undefined;
    }

    const unSignTx: KaspaSignTransactionParams = {
      version: txn.version,
      inputs: txn.inputs.map((input) => ({
        path: dbAccount.path,
        prevTxId: input.prevTxId.toString('hex'),
        outputIndex: input.outputIndex,
        sequenceNumber: input.sequenceNumber.toString(),
        output: {
          satoshis: input?.output?.satoshis.toString() ?? '',
          script: bufferUtils.bytesToHex(
            input?.output?.script?.toBuffer() ?? Buffer.alloc(0),
          ),
        },
        sigOpCount: input?.output?.script?.getSignatureOperationsCount() ?? 1,
      })),
      // Send both script (legacy blind-sign) and address/addressN (streaming) so
      // the SDK blind-signs without refTxs and streams once they exist. Change
      // returns to our account address → addressN (device shows KASPA_PAYTOCHANGE);
      // a custom change address falls back to address.
      outputs: txn.outputs.map((output, index) => {
        const satoshis = output.satoshis.toString();
        const script = bufferUtils.bytesToHex(output.script.toBuffer());
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const isChange = index === (txn as any)._changeIndex;
        if (
          isChange &&
          (!encodedTx.changeAddress ||
            encodedTx.changeAddress === dbAccount.address)
        ) {
          return {
            satoshis,
            script,
            scriptVersion: 0,
            addressN: dbAccount.path,
          };
        }
        return {
          satoshis,
          script,
          scriptVersion: 0,
          address: isChange
            ? (encodedTx.changeAddress ?? dbAccount.address)
            : encodedTx.outputs[0]?.address,
        };
      }),
      lockTime: txn.nLockTime.toString(),
      sigHashType: SignatureType.SIGHASH_ALL,
      sigOpCount: 1,
      scheme: EKaspaSignType.Schnorr,
      prefix: chainId,
      refTxs,
      useTweak: addressEncoding !== EAddressEncodings.KASPA_ORG,
    };

    const response = await sdk.kaspaSignTransaction(connectId, deviceId, {
      ...params.deviceParams?.deviceCommonParams,
      ...unSignTx,
    });

    if (response.success) {
      const signatures = response.payload;

      for (const signature of signatures) {
        const input = txn.inputs[signature.index];
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const publicKeyBuf = input?.output?.script?.getPublicKey();
        const publicKey = publicKeyFromX(
          true,
          bufferUtils.bytesToHex(publicKeyBuf),
        );

        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        txn.inputs[signature.index].addSignature(
          txn,
          // @ts-expect-error
          new Transaction.Signature({
            publicKey,
            prevTxId: input.prevTxId,
            outputIndex: input.outputIndex,
            inputIndex: signature.index,
            signature: signature.signature,
            sigtype: SignatureType.SIGHASH_ALL,
          }),
          SigningMethodType.Schnorr,
        );
      }

      const rawTx = bufferUtils.bytesToHex(txn.toBuffer());

      return {
        // TODO: txid ??
        txid: '',
        rawTx,
        encodedTx,
      };
    }
    throw convertDeviceError(response.payload);
  }

  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }
}
