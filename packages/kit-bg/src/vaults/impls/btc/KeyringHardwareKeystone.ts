import * as BitcoinJS from 'bitcoinjs-lib';

import {
  checkBtcAddressIsUsed,
  convertBtcForkXpub,
  getBtcForkNetwork,
  initBitcoinEcc,
  isTaprootPath,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { buildPsbt } from '@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { slicePathTemplate } from '@onekeyhq/core/src/utils';
import {
  AddressNotSupportSignMethodError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ThirdPartyMethodNotSupported } from '@onekeyhq/shared/src/errors/errors/thirdPartyHardwareErrors';
import { convertThirdPartyDeviceError } from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { thirdPartyConnectionContextFromDevice } from '../../base/thirdPartyHardwareCommonParams';

import { KeyringHardwareBtcBase } from './KeyringHardwareBtcBase';

import type VaultBtc from './Vault';
import type {
  IDBAccount,
  IDBDevice,
  IDBUtxoAccount,
} from '../../../dbs/local/types';
import type { IThirdPartyHardwareAdapter } from '../../../services/ServiceHardware/adapters/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

const VENDOR_ERROR_CONTEXT = { vendor: 'Keystone', chain: 'Bitcoin' } as const;

/**
 * Keystone BTC keyring.
 *
 * Account creation is xpub-driven, not address-driven: `btcGetPublicKey`
 * returns the account-level extended key Keystone synced, and every address
 * is derived from it locally (`getAddressFromXpub`). That is why BTC works
 * here at all — `btcGetAddress` alone could not build an account, and taproot
 * is fine at this level because an xpub is script-type agnostic.
 *
 * Signing is PSBT-only: the Keystone SDK implements `btcSignPsbt` but has no
 * `btcSignTransaction`, so structured App transactions are converted to PSBT
 * before they cross the hardware boundary.
 */
export class KeyringHardwareKeystone extends KeyringHardwareBtcBase {
  override coreApi = coreChainApi.btc.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'btc';

  override async buildHwAllNetworkPrepareAccountsParams({
    template,
    index,
  }: IBuildHwAllNetworkPrepareAccountsParams): Promise<
    AllNetworkAddressParams | undefined
  > {
    return {
      network: this.hwSdkNetwork,
      path: this.buildPrepareAccountsPrefixedPath({ template, index }),
      showOnOneKey: false,
    };
  }

  private async _getAdapter(): Promise<IThirdPartyHardwareAdapter> {
    const adapter =
      await this.backgroundApi.serviceThirdPartyHardware.getAdapterForVendor(
        EHardwareVendor.keystone,
      );
    if (!adapter) {
      throw new OneKeyLocalError('Keystone adapter not available');
    }
    return adapter;
  }

  private async _getMasterFingerprint(
    adapter: IThirdPartyHardwareAdapter,
    dbDevice: IDBDevice,
    interactionId?: string,
  ): Promise<string> {
    const result = await adapter.hw.btcGetMasterFingerprint(
      interactionId ?? dbDevice.connectId,
      dbDevice.deviceId,
      {
        ...thirdPartyConnectionContextFromDevice(dbDevice),
        ...(interactionId ? { interactionId } : {}),
      },
    );
    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, VENDOR_ERROR_CONTEXT);
    }
    const masterFingerprint = result.payload.masterFingerprint.toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(masterFingerprint)) {
      throw new OneKeyLocalError(
        'Keystone returned an invalid BIP32 master fingerprint',
      );
    }
    return masterFingerprint;
  }

  private _formatRootFingerprint(rootFingerprint?: number): string | undefined {
    if (
      rootFingerprint === undefined ||
      !Number.isInteger(rootFingerprint) ||
      rootFingerprint < 0 ||
      rootFingerprint > 0xff_ff_ff_ff
    ) {
      return undefined;
    }
    return rootFingerprint.toString(16).padStart(8, '0');
  }

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
        const { template } = params.deriveInfo;
        const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
          params,
          usedIndexes,
          hwSdkNetwork: this.hwSdkNetwork,
          buildPath: ({ index }) =>
            this.buildPrepareAccountsPrefixedPath({ template, index }),
          buildResultAccount: ({ account }) => ({
            path: account.path,
            xpub: account.payload?.xpub ?? '',
            __hwExtraInfo__: {
              rootFingerprint: account.payload?.rootFingerprint,
            },
          }),
        });
        if (!allNetworkAccounts) {
          throw new OneKeyLocalError(
            'Keystone account preparation requires an all-network response',
          );
        }

        const ret: ICoreApiGetAddressItem[] = [];
        for (const account of allNetworkAccounts.payload) {
          const accountPath = account.path;
          const rawXpub = account.xpub;
          const xpub = addressEncoding
            ? convertBtcForkXpub({
                btcForkNetwork: network,
                xpub: rawXpub,
                addressEncoding,
              })
            : rawXpub;

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

          // P2TR: getAddressFromXpub only emits a bare tr(xpub). Blockbook
          // needs a BIP-380 descriptor with the 4-byte BIP32 fingerprint to scan
          // 0/* and 1/*, and PSBT signing needs it to identify the signer.
          let xpubSegwit = bareXpubSegwit;
          if (addressEncoding === EAddressEncodings.P2TR) {
            const { dbDevice } = params.deviceParams;
            const interactionId =
              params.deviceParams.deviceCommonParams?.interactionId;
            const bundledMasterFingerprint = this._formatRootFingerprint(
              account.__hwExtraInfo__?.rootFingerprint,
            );
            const masterFingerprint =
              bundledMasterFingerprint ??
              (await this._getMasterFingerprint(
                await this._getAdapter(),
                dbDevice,
                interactionId,
              ));
            xpubSegwit = `tr([${masterFingerprint}${accountPath.substring(
              1,
            )}]${xpub}/<0;1>/*)`;
          }

          ret.push({
            address,
            publicKey,
            path: accountPath,
            relPath: addressRelPath,
            xpub,
            xpubSegwit,
            addresses: {
              [addressRelPath]: address,
            },
            __hwExtraInfo__: account.__hwExtraInfo__,
          });
        }
        return ret;
      },
    });
  }

  /**
   * Address enumeration for the account picker. Overridden because the
   * inherited `KeyringHardwareBtcBase.batchGetAddresses` reaches for the
   * OneKey SDK (`getHardwareSDKInstance`), which hard-throws for any
   * non-OneKey vendor — Ledger and Trezor override it for the same reason.
   * Derived from the account xpub rather than a per-index device call, so a
   * whole page of candidates costs at most one round trip (and none at all
   * once the account is in the adapter's cache).
   */
  override async batchGetAddresses(params: IPrepareHardwareAccountsParams) {
    const { indexes, deviceParams, chainExtraParams } = params;
    const { dbDevice } = deviceParams;
    const { template } = params.deriveInfo;
    const { receiveAddressPath } = chainExtraParams ?? {};
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);

    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressEncoding = params.deriveInfo?.addressEncoding;
    const adapter = await this._getAdapter();
    const interactionId = deviceParams.deviceCommonParams?.interactionId;

    if (params.isVerifyAddressAction) {
      throw new OneKeyLocalError({
        message:
          'Keystone address verification requires manual derivation-path confirmation',
      });
    }

    const requests = indexes.map((index) => {
      const fullPath =
        receiveAddressPath ??
        `${pathPrefix}/${pathSuffix.replace('{index}', `${index}`)}`;
      return {
        fullPath,
        accountPath: accountUtils.removePathLastSegment({
          path: fullPath,
          removeCount: 2,
        }),
        addressRelPath: fullPath.split('/').filter(Boolean).slice(-2).join('/'),
      };
    });
    const result = await adapter.hw.allNetworkGetAddress(
      interactionId ?? dbDevice.connectId,
      dbDevice.deviceId,
      {
        ...thirdPartyConnectionContextFromDevice(dbDevice),
        ...(interactionId ? { interactionId } : {}),
        bundle: requests.map(({ accountPath }) => ({
          methodName: 'btcGetPublicKey',
          network: this.hwSdkNetwork,
          path: accountPath,
          coin: networkInfo.networkChainCode ?? 'btc',
          showOnDevice: false,
        })),
      },
    );
    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, VENDOR_ERROR_CONTEXT);
    }

    const addresses: Array<{ path: string; address: string }> = [];
    for (const [index, item] of result.payload.entries()) {
      if (!item.success) {
        throw convertThirdPartyDeviceError(
          {
            code: Number(item.payload?.code),
            error:
              item.payload?.error ?? 'Keystone BTC public-key export failed',
            params: item.payload?.params,
          },
          VENDOR_ERROR_CONTEXT,
        );
      }
      const rawXpub = item.payload?.xpub;
      if (typeof rawXpub !== 'string' || !rawXpub) {
        throw new OneKeyLocalError(
          'Keystone all-network response is missing the BTC xpub',
        );
      }
      const xpub = addressEncoding
        ? convertBtcForkXpub({
            btcForkNetwork: network,
            xpub: rawXpub,
            addressEncoding,
          })
        : rawXpub;
      const addressRelPath = requests[index].addressRelPath;
      const { addresses: addressFromXpub } = await checkIsDefined(
        this.coreApi,
      ).getAddressFromXpub({
        network,
        xpub,
        relativePaths: [addressRelPath],
        addressEncoding,
      });

      addresses.push({
        path: requests[index].fullPath,
        address: addressFromXpub[addressRelPath],
      });
    }
    return addresses;
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, deviceParams } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxBtc;
    const { psbtHex, inputsToSign } = encodedTx;

    if (psbtHex && inputsToSign) {
      return this.signPsbt(params);
    }

    const checkedDeviceParams = checkIsDefined(deviceParams);
    const { dbDevice } = checkedDeviceParams;
    const adapter = await this._getAdapter();
    const dbAccount = (await this.vault.getAccount()) as IDBUtxoAccount;
    const networkInfo = await this.getCoreApiNetworkInfo();
    const btcNetwork = getBtcForkNetwork(networkInfo.networkChainCode);
    const vault = this.vault as VaultBtc;
    const { btcExtraInfo } = await vault.prepareBtcSignExtraInfo({
      unsignedTx,
    });
    const deriveType =
      await this.backgroundApi.serviceNetwork.getDeriveTypeByTemplate({
        accountId: dbAccount.id,
        networkId: this.networkId,
        template: dbAccount.template,
      });
    const addressEncoding = deriveType.deriveInfo?.addressEncoding;
    if (!addressEncoding) {
      throw new OneKeyLocalError('addressEncoding not found');
    }

    const masterFingerprint = await this._getMasterFingerprint(
      adapter,
      dbDevice,
      checkedDeviceParams.deviceCommonParams?.interactionId,
    );
    const derivedPublicKeys = new Map<string, string>();
    initBitcoinEcc();
    const psbt = await buildPsbt({
      network: btcNetwork,
      unsignedTx,
      btcExtraInfo,
      buildInputMixinInfo: async ({ address }) => {
        const pathInfo = btcExtraInfo.addressToPath?.[address];
        if (!pathInfo?.relPath || !pathInfo.fullPath) {
          throw new OneKeyLocalError('BTC input derivation path not found');
        }
        const addressInfo = await checkIsDefined(
          this.coreApi,
        ).getAddressFromXpub({
          network: btcNetwork,
          xpub: dbAccount.xpub,
          relativePaths: [pathInfo.relPath],
          addressEncoding,
        });
        const publicKey = addressInfo.publicKeys[pathInfo.relPath];
        if (!publicKey) {
          throw new OneKeyLocalError('BTC input public key not found');
        }
        derivedPublicKeys.set(address, publicKey);
        const pubkey = Buffer.from(publicKey, 'hex');
        return {
          pubkey,
          bip32Derivation: [
            {
              masterFingerprint: Buffer.from(masterFingerprint, 'hex'),
              pubkey,
              path: pathInfo.fullPath,
            },
          ],
        };
      },
    });
    const builtInputsToSign = encodedTx.inputs.map((input, index) => ({
      index,
      address: input.address,
      publicKey: checkIsDefined(derivedPublicKeys.get(input.address)),
    }));

    return this._signPsbt(
      {
        ...params,
        unsignedTx: {
          ...unsignedTx,
          encodedTx: {
            ...encodedTx,
            psbtHex: psbt.toHex(),
            inputsToSign: builtInputsToSign,
          },
        },
      },
      { allowNonTaproot: true, enrichTaprootInputs: false },
    );
  }

  override async signPsbt(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    return this._signPsbt(params, {
      allowNonTaproot: false,
      enrichTaprootInputs: true,
    });
  }

  private async _signPsbt(
    params: ISignTransactionParams,
    options: {
      allowNonTaproot: boolean;
      enrichTaprootInputs: boolean;
    },
  ): Promise<ISignedTxPro> {
    const { unsignedTx, signOnly, deviceParams } = params;
    const checkedDeviceParams = checkIsDefined(deviceParams);
    const { dbDevice } = checkedDeviceParams;
    const { psbtHex, inputsToSign } = unsignedTx.encodedTx as IEncodedTxBtc;

    if (!psbtHex) {
      throw new OneKeyLocalError('signPsbt requires psbtHex');
    }

    const dbAccount = await this.vault.getAccount();
    if (!options.allowNonTaproot && !isTaprootPath(dbAccount.path)) {
      throw new AddressNotSupportSignMethodError({
        info: {
          type: 'Taproot',
        },
      });
    }

    const adapter = await this._getAdapter();
    initBitcoinEcc();

    const networkInfo = await this.getCoreApiNetworkInfo();
    const btcNetwork = getBtcForkNetwork(networkInfo.networkChainCode);

    let enrichedPsbtHex = psbtHex;

    // Taproot inputs must carry tapBip32Derivation so the device can match
    // them to its own keys. btcGetPublicKey/account sync normally leaves the
    // 4-byte MFP in the same adapter record, so this is an in-memory read.
    if (
      options.enrichTaprootInputs &&
      isTaprootPath(dbAccount.path) &&
      inputsToSign?.length
    ) {
      const masterFingerprint = await this._getMasterFingerprint(
        adapter,
        dbDevice,
        checkedDeviceParams.deviceCommonParams?.interactionId,
      );
      const fp = Buffer.from(masterFingerprint, 'hex');
      const psbt = BitcoinJS.Psbt.fromHex(psbtHex, { network: btcNetwork });
      const { resolvePubkeyHexByAddress, resolvePathByAddress } =
        await this.resolvePsbtAddressDerivation({
          unsignedTx,
          dbAccount: dbAccount as IDBUtxoAccount,
          btcNetwork,
          addresses: inputsToSign.map((input) => input.address),
        });
      for (const input of inputsToSign) {
        const pubkeyHex = resolvePubkeyHexByAddress({
          address: input.address,
          fallbackPubkeyHex: input.publicKey,
        });
        psbt.updateInput(input.index, {
          tapBip32Derivation: [
            {
              masterFingerprint: fp,
              pubkey: Buffer.from(pubkeyHex, 'hex').subarray(1, 33),
              path: resolvePathByAddress(input.address),
              leafHashes: [],
            },
          ],
        });
      }
      enrichedPsbtHex = psbt.toHex();
    }

    const result = await adapter.hw.btcSignPsbt(
      checkedDeviceParams.deviceCommonParams?.interactionId ??
        dbDevice.connectId,
      dbDevice.deviceId,
      {
        ...thirdPartyConnectionContextFromDevice(dbDevice),
        ...(checkedDeviceParams.deviceCommonParams?.interactionId
          ? {
              interactionId:
                checkedDeviceParams.deviceCommonParams.interactionId,
            }
          : {}),
        psbt: enrichedPsbtHex,
        coin: networkInfo.networkChainCode?.toLowerCase() || 'bitcoin',
        path: dbAccount.path,
      },
    );
    if (!result.success) {
      throw convertThirdPartyDeviceError(result.payload, VENDOR_ERROR_CONTEXT);
    }

    const signedPsbtHex = result.payload.signedPsbt;

    let rawTx = '';
    let finalizedPsbtHex = '';
    try {
      const finalizedPsbt = BitcoinJS.Psbt.fromHex(signedPsbtHex, {
        network: btcNetwork,
      });
      inputsToSign?.forEach((v) => {
        finalizedPsbt.finalizeInput(v.index);
      });
      if (!signOnly) {
        rawTx = finalizedPsbt.extractTransaction().toHex();
      }
      finalizedPsbtHex = finalizedPsbt.toHex();
    } catch {
      // Device returned a partially-signed PSBT (multisig, or otherwise not
      // ready to finalize): hand it back as-is rather than dropping signatures.
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
    const { messages, deviceParams } = params;
    const checkedDeviceParams = checkIsDefined(deviceParams);
    const { dbDevice } = checkedDeviceParams;
    const adapter = await this._getAdapter();
    const dbAccount = await this.vault.getAccount();
    const networkInfo = await this.getCoreApiNetworkInfo();
    const path = `${dbAccount.path}/${dbAccount.relPath ?? '0/0'}`;

    const signatures: ISignedMessagePro = [];
    for (const payload of messages as Array<{
      message: string;
      type?: string;
    }>) {
      // BIP-322 is a distinct signing scheme the SDK does not implement;
      // silently signing it as a legacy message would produce a signature
      // verifiers reject.
      if (payload.type === 'bip322-simple') {
        throw new ThirdPartyMethodNotSupported();
      }
      const result =
        // eslint-disable-next-line no-await-in-loop
        await adapter.hw.btcSignMessage(
          checkedDeviceParams.deviceCommonParams?.interactionId ??
            dbDevice.connectId,
          dbDevice.deviceId,
          {
            ...thirdPartyConnectionContextFromDevice(dbDevice),
            ...(checkedDeviceParams.deviceCommonParams?.interactionId
              ? {
                  interactionId:
                    checkedDeviceParams.deviceCommonParams.interactionId,
                }
              : {}),
            path,
            message: payload.message,
            coin: networkInfo.networkChainCode ?? 'btc',
          },
        );
      if (!result.success) {
        throw convertThirdPartyDeviceError(
          result.payload,
          VENDOR_ERROR_CONTEXT,
        );
      }
      signatures.push(result.payload.signature);
    }
    return signatures;
  }
}
