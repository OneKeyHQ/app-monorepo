import { Psbt } from 'bitcoinjs-lib';

import {
  convertBtcScriptTypeForHardware,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { buildPsbt } from '@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { getAirGapSdk } from '@onekeyhq/qr-wallet-sdk';
import {
  NotImplemented,
  OneKeyErrorAirGapAccountNotFound,
} from '@onekeyhq/shared/src/errors';
import { CoreSDKLoader } from '@onekeyhq/shared/src/hardware/instance';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import localDb from '../../../dbs/local/localDb';
import { KeyringQrBase } from '../../base/KeyringQrBase';

import type VaultBtc from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetChildPathTemplatesParams,
  IGetChildPathTemplatesResult,
  IPrepareQrAccountsParams,
  IQrWalletGetVerifyAddressChainParamsQuery,
  IQrWalletGetVerifyAddressChainParamsResult,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringQr extends KeyringQrBase {
  override coreApi = coreChainApi.btc.hd;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override getChildPathTemplates(
    params: IGetChildPathTemplatesParams,
  ): IGetChildPathTemplatesResult {
    return {
      childPathTemplates: [accountUtils.buildUtxoAddressRelPath()],
    };
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const vault = this.vault as VaultBtc;

    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);

    const { btcExtraInfo } = await vault.prepareBtcSignExtraInfo({
      unsignedTx,
    });
    const dbAccount = await this.vault.getAccount();
    const wallet = await localDb.getWallet({ walletId: this.walletId });

    const { airGapAccount } = await this.findAirGapAccountByDbAccount({
      dbAccount,
      wallet,
    });
    const xpub = airGapAccount?.extendedPublicKey;
    if (!xpub) {
      throw new Error('xpub not found');
    }
    const deriveType =
      await this.backgroundApi.serviceNetwork.getDeriveTypeByTemplate({
        networkId: this.networkId,
        template: dbAccount.template,
      });
    const addressEncoding = deriveType.deriveInfo?.addressEncoding;
    if (!addressEncoding) {
      throw new Error('addressEncoding not found');
    }

    const signedTx = await this.baseSignByQrcode(params, {
      signRequestUrBuilder: async ({
        path,
        account,
        chainId,
        requestId,
        xfp,
      }) => {
        const psbt = await buildPsbt({
          network: getBtcForkNetwork(networkInfo.networkChainCode),
          unsignedTx,
          btcExtraInfo,
          buildInputMixinInfo: async ({ address }) => {
            const relPath = btcExtraInfo?.addressToPath?.[address]?.relPath;
            const fullPath = btcExtraInfo?.addressToPath?.[address]?.fullPath;
            if (!relPath) {
              throw new Error('relPath not found');
            }
            const xpubAddressInfo = await this.coreApi.getAddressFromXpub({
              network,
              xpub,
              relativePaths: [relPath],
              addressEncoding,
            });
            const { [relPath]: publicKey } = xpubAddressInfo.publicKeys;
            if (publicKey) {
              const pubkeyBuffer = Buffer.from(publicKey, 'hex');
              return {
                pubkey: pubkeyBuffer,
                bip32Derivation: [
                  {
                    masterFingerprint: Buffer.from(xfp, 'hex'),
                    pubkey: pubkeyBuffer,
                    path: fullPath,
                  },
                ],
              };
            }
            return {
              pubkey: undefined,
            };
          },
          // Promise.resolve(),
        });
        const sdk = getAirGapSdk();
        // sdk.btc.generateSignRequest  signMessage
        return sdk.btc.generatePSBT(psbt.toBuffer());
      },
      signedResultBuilder: async ({ signatureUr }) => {
        const sdk = getAirGapSdk();
        // **** sign message
        // const sig = sdk.btc.parseSignature(ur);
        // **** sign psbt
        const psbtHex = sdk.btc.parsePSBT(checkIsDefined(signatureUr));
        const psbt = Psbt.fromHex(psbtHex);
        // TODO extension serializes Error?
        const { rawTx, txid } = await this.coreApi.extractPsbtToSignedTx({
          psbt,
        });
        return Promise.resolve({
          txid,
          rawTx,
          encodedTx: params.unsignedTx.encodedTx,
        });
      },
    });
    return signedTx;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override signMessage(params: ISignMessageParams): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }

  override async getVerifyAddressChainParams(
    query: IQrWalletGetVerifyAddressChainParamsQuery,
  ): Promise<IQrWalletGetVerifyAddressChainParamsResult> {
    const { fullPath } = query;
    const { getHDPath, getScriptType } = await CoreSDKLoader();
    const addressN = getHDPath(fullPath);
    const scriptType = getScriptType(addressN);
    return {
      scriptType: String(convertBtcScriptTypeForHardware(scriptType)),
    };
  }

  override async prepareAccounts(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: IPrepareQrAccountsParams,
  ): Promise<IDBAccount[]> {
    const wallet = await localDb.getWallet({ walletId: this.walletId });
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressEncoding = params.deriveInfo?.addressEncoding;

    return this.basePrepareHdUtxoAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        // TODO move to base
        if (params?.isVerifyAddressAction) {
          return this.verifyQrWalletAddressByTwoWayScan(params, {
            indexes: usedIndexes,
          });
        }

        const ret: ICoreApiGetAddressItem[] = [];

        for (const index of usedIndexes) {
          const { fullPath, airGapAccount, childPathTemplate } =
            await this.findAirGapAccountInPrepareAccounts(params, {
              index,
              wallet,
            });

          if (!airGapAccount) {
            throw new OneKeyErrorAirGapAccountNotFound();
          }

          // let xpub = airGapAccount?.publicKey;
          let xpub = '';
          let addressRelPath: string | undefined;

          if (childPathTemplate) {
            const childPath = accountUtils.buildPathFromTemplate({
              template: childPathTemplate,
              index,
            });
            addressRelPath = childPath;
            const extendedPublicKey = airGapAccount?.extendedPublicKey;
            if (!extendedPublicKey) {
              throw new Error('xpub not found');
            }
            xpub = extendedPublicKey;
          }

          if (!xpub) {
            throw new Error('publicKey not found');
          }
          if (!addressRelPath) {
            throw new Error('addressRelPath not found');
          }

          const xpubAddressInfo = await this.coreApi.getAddressFromXpub({
            network,
            xpub,
            relativePaths: [addressRelPath],
            addressEncoding,
          });
          const { [addressRelPath]: address } = xpubAddressInfo.addresses;
          const { [addressRelPath]: publicKey } = xpubAddressInfo.publicKeys;

          const addressInfo: ICoreApiGetAddressItem = {
            address,
            publicKey,
            path: airGapAccount.path,
            relPath: addressRelPath,
            xpub,
            xpubSegwit: xpubAddressInfo.xpubSegwit,
            addresses: {
              [addressRelPath]: address,
            },
          };
          ret.push(addressInfo);
          console.log('KeyringQr prepareAccounts', {
            params,
            wallet,
            fullPath,
            airGapAccount,
            addressInfo,
          });
        }
        return ret;
      },
    });
  }
}
