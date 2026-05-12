import * as BitcoinJS from 'bitcoinjs-lib';

import {
  checkBtcAddressIsUsed,
  convertBtcForkXpub,
  getBtcForkNetwork,
  getPublicKeyFromXpub,
  initBitcoinEcc,
  isTaprootPath,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  EAddressEncodings,
  type ICoreApiGetAddressItem,
  type ISignedMessagePro,
  type ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { slicePathTemplate } from '@onekeyhq/core/src/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import {
  EConfirmOnDeviceType,
  EHardwareVendor,
} from '@onekeyhq/shared/types/device';

import {
  callLedgerWithFingerprint,
  ensureLedgerChainFingerprint,
} from '../../base/ledgerFingerprintUtils';

import { KeyringHardwareBtcBase } from './KeyringHardwareBtcBase';

import type VaultBtc from './Vault';
import type { IDBAccount, IDBUtxoAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

export class KeyringHardwareLedger extends KeyringHardwareBtcBase {
  override coreApi = coreChainApi.btc.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'btc';

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressEncoding = params.deriveInfo?.addressEncoding;
    const addressRelPath = accountUtils.buildUtxoAddressRelPath();

    return this.basePrepareHdUtxoAccounts(params, {
      checkIsAccountUsed: checkBtcAddressIsUsed,
      buildAddressesInfo: async ({ usedIndexes }) => {
        const { dbDevice } = params.deviceParams;
        const { template } = params.deriveInfo;

        const adapter =
          await this.backgroundApi.serviceHardware.getAdapterForVendor(
            EHardwareVendor.ledger,
          );

        if (!adapter) {
          throw new OneKeyLocalError(
            'Ledger adapter not available for BTC account creation',
          );
        }

        const ret: ICoreApiGetAddressItem[] = [];
        for (const index of usedIndexes) {
          const fullPath = accountUtils.buildPathFromTemplate({
            template,
            index,
          });
          // BTC needs the account-level path (remove last 2 segments: change/index)
          const accountPath = accountUtils.removePathLastSegment({
            path: fullPath,
            removeCount: 2,
          });

          // Get xpub from Ledger device
          const pubKeyResult = await callLedgerWithFingerprint(
            this.backgroundApi,
            dbDevice,
            'btc',
            (deviceId) =>
              adapter.hw.btcGetPublicKey(dbDevice.connectId, deviceId, {
                path: accountPath,
                showOnDevice: params.isVerifyAddressAction ?? false,
              }),
          );

          if (!pubKeyResult.success) {
            throw convertThirdPartyDeviceError(pubKeyResult.payload, {
              vendor: 'Ledger',
              chain: 'Bitcoin',
            });
          }

          const rawXpubField: unknown = pubKeyResult.payload.xpub;
          // Ledger DMK may return { extendedPublicKey: string } instead of string
          const rawXpub =
            typeof rawXpubField === 'string'
              ? rawXpubField
              : ((rawXpubField as { extendedPublicKey: string })
                  ?.extendedPublicKey ?? String(rawXpubField));

          // Ledger DMK always returns an xpub with standard mainnet version
          // bytes regardless of BIP purpose. Re-encode the version bytes to
          // match the encoding so downstream tools (blockbook, exporters)
          // interpret the address type correctly.
          const xpub = addressEncoding
            ? convertBtcForkXpub({
                btcForkNetwork: network,
                xpub: rawXpub,
                addressEncoding,
              })
            : rawXpub;

          // Derive address from xpub
          const {
            addresses: addressFromXpub,
            publicKeys: publicKeysMap,
            xpubSegwit: bareXpubSegwit,
          } = await checkIsDefined(this.coreApi).getAddressFromXpub({
            network,
            xpub,
            relativePaths: [addressRelPath],
            addressEncoding,
          });
          const { [addressRelPath]: publicKey } = publicKeysMap;
          const { [addressRelPath]: address } = addressFromXpub;

          // For P2TR, build a full BIP380 descriptor with the device master
          // fingerprint + origin path + multipath children, so blockbook scans
          // both 0/* and 1/* sub-paths and PSBT signing can identify the
          // signing device. coreApi.getAddressFromXpub only emits a bare
          // `tr(xpub)` since it has no master xfp on hand.
          let xpubSegwit = bareXpubSegwit;
          if (addressEncoding === EAddressEncodings.P2TR) {
            const masterXfp = await ensureLedgerChainFingerprint(
              this.backgroundApi,
              dbDevice,
              'btc',
            );
            if (masterXfp) {
              xpubSegwit = `tr([${masterXfp}${accountPath.substring(
                1,
              )}]${xpub}/<0;1>/*)`;
            }
          }

          const addressInfo: ICoreApiGetAddressItem = {
            address,
            publicKey,
            path: accountPath,
            relPath: addressRelPath,
            xpub,
            xpubSegwit,
            addresses: {
              [addressRelPath]: address,
            },
            __hwExtraInfo__: {
              rootFingerprint: 0,
            },
          };
          ret.push(addressInfo);
        }
        return ret;
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const { psbtHex, inputsToSign } = unsignedTx.encodedTx as IEncodedTxBtc;

    if (psbtHex && inputsToSign) {
      return this.signPsbt(params);
    }

    return this.signNormalTransaction(params);
  }

  private async signNormalTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, signOnly: _signOnly, deviceParams } = params;
    const { dbDevice } = checkIsDefined(deviceParams);
    const encodedTx = unsignedTx.encodedTx as IEncodedTxBtc;
    let { psbtHex } = encodedTx;

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    initBitcoinEcc();

    const dbAccount = await this.vault.getAccount();
    const networkInfo = await this.getCoreApiNetworkInfo();
    const btcNetwork = getBtcForkNetwork(networkInfo.networkChainCode);

    // Build per-input derivation paths
    let inputPaths: Array<{ path: string }> = [];

    if (!psbtHex) {
      // Normal send: construct PSBT from inputs/outputs
      const { inputs, outputs } = encodedTx;
      const network = btcNetwork;
      const psbt = new BitcoinJS.Psbt({ network });

      const vault = this.vault as VaultBtc;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const { utxoList } = await vault._collectUTXOsInfoByApi();
      const addressPathMap: Record<string, string> = {};
      for (const utxo of utxoList) {
        if (utxo.address && utxo.path) {
          addressPathMap[utxo.address] = utxo.path;
        }
      }

      // Fetch full previous transactions
      const prevTxids = [...new Set(inputs.map((i) => i.txid).filter(Boolean))];
      const prevTxMap: Record<string, string> =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await vault.collectTxsByApi(prevTxids);

      // Get xpub and master fingerprint for BIP32 derivation
      const utxoAccount = dbAccount as IDBUtxoAccount;
      const xpub = utxoAccount.xpubSegwit || utxoAccount.xpub;
      const fpResult = await callLedgerWithFingerprint(
        this.backgroundApi,
        dbDevice,
        'btc',
        (deviceId) =>
          adapter.hw.btcGetMasterFingerprint(dbDevice.connectId, deviceId),
      );
      if (!fpResult.success) {
        throw convertThirdPartyDeviceError(fpResult.payload, {
          vendor: 'Ledger',
          chain: 'Bitcoin',
        });
      }
      const masterFingerprint = Buffer.from(
        fpResult.payload.masterFingerprint,
        'hex',
      );

      const isTaproot = dbAccount.path.includes("86'");

      for (const input of inputs) {
        const scriptPubKey = BitcoinJS.address.toOutputScript(
          input.address,
          network,
        );
        const fullPath = addressPathMap[input.address] || dbAccount.path;
        // Derive relative path from account path (e.g. "0/0")
        const accountPathParts = dbAccount.path.replace(/^m\//, '').split('/');
        const fullPathParts = fullPath.replace(/^m\//, '').split('/');
        const relPath = fullPathParts.slice(accountPathParts.length).join('/');

        const inputData: any = {
          hash: input.txid,
          index: input.vout,
          witnessUtxo: {
            script: scriptPubKey,
            value: BigInt(input.value),
          },
        };

        if (prevTxMap[input.txid]) {
          // BIP-174: nonWitnessUtxo must be non-witness serialization.
          // Use __toBuffer with ALLOW_WITNESS=false to force non-witness format.
          const prevTx = BitcoinJS.Transaction.fromHex(prevTxMap[input.txid]);
          inputData.nonWitnessUtxo = Buffer.from(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            (prevTx as any).__toBuffer(undefined, undefined, false),
          );
        }

        // Add BIP32 derivation info (required by Ledger BTC App)
        if (isTaproot) {
          // Taproot: x-only key from P2TR script
          const xOnlyKey = scriptPubKey.slice(2, 34);
          inputData.tapInternalKey = xOnlyKey;
          inputData.tapBip32Derivation = [
            {
              masterFingerprint,
              pubkey: xOnlyKey,
              path: fullPath,
              leafHashes: [],
            },
          ];
        } else if (xpub && relPath) {
          // Legacy/SegWit: derive compressed pubkey from xpub
          const pubkeyHex = getPublicKeyFromXpub({
            xpub,
            network,
            relPath,
          });
          inputData.bip32Derivation = [
            {
              masterFingerprint,
              pubkey: Buffer.from(pubkeyHex, 'hex'),
              path: fullPath,
            },
          ];
        }

        psbt.addInput(inputData);
        inputPaths.push({ path: fullPath });
      }

      for (const output of outputs) {
        if (output.payload?.opReturn) {
          const data = Buffer.from(output.payload.opReturn, 'hex');
          const embed = BitcoinJS.payments.embed({ data: [data] });
          psbt.addOutput({
            script: embed.output!,
            value: BigInt(0),
          });
        } else {
          psbt.addOutput({
            address: output.address,
            value: BigInt(output.value),
          });
        }
      }

      psbtHex = psbt.toHex();
    } else {
      inputPaths = [{ path: dbAccount.path }];
    }

    const result = await callLedgerWithFingerprint(
      this.backgroundApi,
      dbDevice,
      'btc',
      (deviceId) =>
        adapter.hw.btcSignTransaction(dbDevice.connectId, deviceId, {
          psbt: psbtHex,
          coin: networkInfo.networkChainCode?.toLowerCase() || 'bitcoin',
          path: dbAccount.path,
          inputs: inputPaths.map((p) => ({
            path: p.path,
            prevHash: '',
            prevIndex: 0,
            amount: '0',
          })),
        }),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Ledger',
        chain: 'Bitcoin',
      });
    }

    // Ledger SDK's signTransaction returns a fully signed raw tx hex
    // (internally it does sign → finalize → extractTransaction)
    const { serializedTx } = result.payload;
    if (!serializedTx) {
      throw new OneKeyLocalError('Missing signed transaction data from Ledger');
    }
    const tx = BitcoinJS.Transaction.fromHex(serializedTx);

    return {
      txid: tx.getId(),
      rawTx: serializedTx,
      encodedTx: unsignedTx.encodedTx,
    };
  }

  override async signPsbt(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, signOnly, deviceParams } = params;
    const { dbDevice } = checkIsDefined(deviceParams);
    const { psbtHex } = unsignedTx.encodedTx as IEncodedTxBtc;

    if (!psbtHex) {
      throw new OneKeyLocalError('signPsbt requires psbtHex');
    }

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    initBitcoinEcc();

    const dbAccount = await this.vault.getAccount();
    const networkInfo = await this.getCoreApiNetworkInfo();
    const btcNetwork = getBtcForkNetwork(networkInfo.networkChainCode);

    let enrichedPsbtHex = psbtHex;

    if (isTaprootPath(dbAccount.path)) {
      const { inputsToSign } = unsignedTx.encodedTx as IEncodedTxBtc;
      if (inputsToSign?.length) {
        const fpResult = await callLedgerWithFingerprint(
          this.backgroundApi,
          dbDevice,
          'btc',
          (deviceId) =>
            adapter.hw.btcGetMasterFingerprint(dbDevice.connectId, deviceId),
        );
        if (fpResult.success) {
          const fp = Buffer.from(fpResult.payload.masterFingerprint, 'hex');
          const psbt = BitcoinJS.Psbt.fromHex(psbtHex, { network: btcNetwork });
          for (const input of inputsToSign) {
            psbt.updateInput(input.index, {
              tapBip32Derivation: [
                {
                  masterFingerprint: fp,
                  pubkey: Buffer.from(input.publicKey, 'hex').subarray(1, 33),
                  path: `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`,
                  leafHashes: [],
                },
              ],
            });
          }
          enrichedPsbtHex = psbt.toHex();
        }
      }
    }

    const result = await callLedgerWithFingerprint(
      this.backgroundApi,
      dbDevice,
      'btc',
      (deviceId) =>
        adapter.hw.btcSignPsbt(dbDevice.connectId, deviceId, {
          psbt: enrichedPsbtHex,
          coin: networkInfo.networkChainCode?.toLowerCase() || 'bitcoin',
          path: dbAccount.path,
        }),
    );

    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, {
        vendor: 'Ledger',
        chain: 'Bitcoin',
      });
    }

    const signedPsbtHex = result.payload.signedPsbt;

    let rawTx = '';
    let finalizedPsbtHex = '';

    try {
      const finalizedPsbt = BitcoinJS.Psbt.fromHex(signedPsbtHex, {
        network: btcNetwork,
      });

      const { inputsToSign } = unsignedTx.encodedTx as IEncodedTxBtc;
      if (inputsToSign) {
        inputsToSign.forEach((v) => {
          finalizedPsbt.finalizeInput(v.index);
        });
      }

      if (!signOnly) {
        rawTx = finalizedPsbt.extractTransaction().toHex();
      }
      finalizedPsbtHex = finalizedPsbt.toHex();
    } catch {
      finalizedPsbtHex = signedPsbtHex;
    }

    return {
      encodedTx: unsignedTx.encodedTx,
      txid: '',
      rawTx,
      psbtHex: signedPsbtHex,
      finalizedPsbtHex,
    };
  }

  override async signMessage(
    params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    const { deviceParams } = params;
    const { dbDevice } = checkIsDefined(deviceParams);
    const dbAccount = await this.vault.getAccount();

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    const networkInfo = await this.getCoreApiNetworkInfo();
    const fullPath = `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`;

    const result = await Promise.all(
      params.messages.map(
        async (payload: { message: string; type?: string }) => {
          if (payload.type === 'bip322-simple') {
            throw new ThirdPartyMethodNotSupported();
          }

          const messageHex = Buffer.from(payload.message).toString('hex');

          const res = await callLedgerWithFingerprint(
            this.backgroundApi,
            dbDevice,
            'btc',
            (deviceId) =>
              adapter.hw.btcSignMessage(dbDevice.connectId, deviceId, {
                path: fullPath,
                message: messageHex,
                coin: networkInfo.networkChainCode?.toLowerCase() || 'bitcoin',
              }),
          );

          if (!res.success) {
            throw convertThirdPartyDeviceError(res.payload, {
              vendor: 'Ledger',
              chain: 'Bitcoin',
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return res.payload.signature;
        },
      ),
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  override async batchGetAddresses(params: IPrepareHardwareAccountsParams) {
    const { indexes, deviceParams, chainExtraParams } = params;
    const { dbDevice, confirmOnDevice } = deviceParams;
    const { template } = params.deriveInfo;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const { receiveAddressPath } = chainExtraParams ?? {};

    const adapter =
      await this.backgroundApi.serviceHardware.getAdapterForVendor(
        EHardwareVendor.ledger,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Ledger adapter not available');
    }

    const addresses: Array<{ path: string; address: string }> = [];

    for (let i = 0; i < indexes.length; i += 1) {
      const index = indexes[i];

      const fullPath =
        receiveAddressPath ??
        `${pathPrefix}/${pathSuffix.replace('{index}', `${index}`)}`;

      // Ledger btcGetAddress needs account-level path + addressIndex + change.
      // Split fullPath "m/44'/0'/1'/0/0" → accountPath, change, addressIndex
      const accountPath = accountUtils.removePathLastSegment({
        path: fullPath,
        removeCount: 2,
      });
      const segments = fullPath.split('/');
      const change = parseInt(segments[segments.length - 2] ?? '0', 10) === 1;
      const addressIndex = parseInt(segments[segments.length - 1] ?? '0', 10);

      let showOnDevice = false;
      if (confirmOnDevice === EConfirmOnDeviceType.EveryItem) {
        showOnDevice = true;
      } else if (confirmOnDevice === EConfirmOnDeviceType.LastItem) {
        showOnDevice = i === indexes.length - 1;
      }

      const result = await callLedgerWithFingerprint(
        this.backgroundApi,
        dbDevice,
        'btc',
        (deviceId) =>
          adapter.hw.btcGetAddress(dbDevice.connectId, deviceId, {
            path: accountPath,
            showOnDevice,
            addressIndex,
            change,
          }),
      );

      if (!result.success) {
        throw convertThirdPartyDeviceError(result.payload, {
          vendor: 'Ledger',
          chain: 'Bitcoin',
        });
      }

      addresses.push({
        path: fullPath,
        address: result.payload.address,
      });
    }

    return addresses;
  }

  override async buildHwAllNetworkPrepareAccountsParams(
    _params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return undefined;
  }
}
