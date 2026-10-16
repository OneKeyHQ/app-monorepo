import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { ZCASH_NETWORK_MAIN } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { fetchZcashChainTipDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
import type { IZcashTransparentTxRequest } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import { getZcashHardwareSdk } from './hardwareSdk';
import { getZcashLifecycleMutex } from './lifecycle';
import { signTransparentTransaction } from './signTransparentTransaction';
import { parseZcashTransaction } from './transactionReview';

import type { IZcashHardwareAddress } from './hardwareSdk';
import type { IEncodedTxZcash } from './types';
import type Vault from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildPrepareAccountsPrefixedPathParams,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

// ZIP-32 account path the device derives shielded keys from.
const buildZcashShieldedPath = (index: number) => `m/32'/133'/${index}'`;

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.zec.hd;

  private async getZcashSdk({ connectId }: { connectId: string }) {
    return getZcashHardwareSdk(
      await this.getHardwareSDKInstance({ connectId }),
    );
  }

  override buildPrepareAccountsPrefixedPath(
    params: IBuildPrepareAccountsPrefixedPathParams,
  ): string {
    const fullPath = accountUtils.buildPathFromTemplate({
      template: params.template,
      index: params.index,
    });
    return accountUtils.removePathLastSegment({
      path: fullPath,
      removeCount: 2,
    });
  }

  // One device round trip returns UA + UFVK + seed fingerprint for a set of
  // account indexes. The transparent account (BIP44 m/44'/133'/i') is
  // rebuilt from the UFVK's transparent FVK, so no second call is needed.
  private async fetchDeviceViewingKeys({
    deviceParams,
    indexes,
    showOnOnekeyFn,
  }: {
    deviceParams: IDeviceSharedCallParams;
    indexes: number[];
    showOnOnekeyFn: (arrIndex: number) => boolean | undefined;
  }): Promise<IZcashHardwareAddress[]> {
    const { connectId, deviceId } = deviceParams.dbDevice;
    const sdk = await this.getZcashSdk({ connectId });
    const response = await sdk.zcashGetAddress(connectId, deviceId, {
      ...deviceParams.deviceCommonParams,
      bundle: indexes.map((index, arrIndex) => ({
        path: buildZcashShieldedPath(index),
        showOnOneKey: showOnOnekeyFn(arrIndex) ?? false,
        addressType: 2,
        scope: 0,
        diversifierIndex: 0,
        includeUfvk: true,
        includeSeedFingerprint: true,
      })),
    });
    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    const items = response.payload;
    if (items.length !== indexes.length) {
      throw new OneKeyLocalError(
        'zcash: device returned unexpected address count',
      );
    }
    for (const item of items) {
      if (!item.ufvk || !item.seedFingerprint) {
        throw new OneKeyLocalError(
          'zcash: device did not return the viewing key for this account',
        );
      }
    }
    return items;
  }

  // One seed per hardware wallet, so one fingerprint per wallet. A device
  // reporting a different one does not hold this wallet's seed.
  private async rememberSeedFingerprint({
    walletId,
    seedFingerprintHex,
  }: {
    walletId: string;
    seedFingerprintHex: string;
  }): Promise<void> {
    const reported = seedFingerprintHex.toLowerCase();
    const stored =
      await this.backgroundApi.simpleDb.zcash.getWalletSeedFingerprint({
        walletId,
      });
    if (stored === reported) {
      return;
    }
    if (stored) {
      throw new OneKeyLocalError(
        'zcash: device seed does not match this wallet',
      );
    }
    await this.backgroundApi.simpleDb.zcash.saveWalletSeedFingerprint({
      walletId,
      seedFingerprintHex: reported,
    });
  }

  override async batchGetAddresses(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IZcashHardwareAddress[]> {
    return this.baseGetDeviceAccountAddresses<IZcashHardwareAddress>({
      params,
      usedIndexes: params.indexes,
      sdkGetAddressFn: async ({ connectId, deviceId, showOnOnekeyFn }) => {
        const sdk = await this.getZcashSdk({ connectId });
        const isPrivate =
          params.chainExtraParams?.localWalletAddressForm === 'private';
        const customPath = params.chainExtraParams?.receiveAddressPath;
        const bundle = params.indexes.map((index, position) => {
          let scope: 0 | 1 = 0;
          let diversifierIndex = 0;
          if (customPath && !isPrivate) {
            const match = customPath.match(
              /^m\/44'\/133'\/(\d+)'\/([01])\/(\d+)$/,
            );
            if (!match || Number(match[1]) !== index) {
              throw new OneKeyLocalError(
                'zcash: invalid address verification path',
              );
            }
            scope = match[2] === '1' ? 1 : 0;
            diversifierIndex = Number(match[3]);
            if (
              !Number.isSafeInteger(diversifierIndex) ||
              diversifierIndex >= 0x80_00_00_00
            ) {
              throw new OneKeyLocalError(
                'zcash: invalid address verification index',
              );
            }
          }
          return {
            path: buildZcashShieldedPath(index),
            addressType: isPrivate ? (2 as const) : (1 as const),
            scope,
            diversifierIndex,
            showOnOneKey: showOnOnekeyFn(position) ?? true,
          };
        });
        return sdk.zcashGetAddress(connectId, deviceId, {
          ...params.deviceParams.deviceCommonParams,
          bundle,
        });
      },
    });
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressRelPath = accountUtils.buildUtxoAddressRelPath();
    const { template } = params.deriveInfo;
    const reportedFingerprints = new Set<string>();

    const accounts = await this.basePrepareHdUtxoAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const { dbDevice, deviceCommonParams } = params.deviceParams;
        const { connectId, deviceId } = dbDevice;
        const sdk = await this.getHardwareSDKInstance({ connectId });
        // Match the root fingerprint used by the shared hardware account flow.
        // Zcash's ZIP-32 seed fingerprint is a different identifier.
        const rootResponse = await sdk.btcGetPublicKey(connectId, deviceId, {
          ...deviceCommonParams,
          path: "m/44'/1'/0'",
          coin: 'Testnet',
          scriptType: 'SPENDADDRESS',
          showOnOneKey: false,
        });
        if (!rootResponse.success) {
          throw convertDeviceError(rootResponse.payload);
        }
        const rootFingerprint = rootResponse.payload.root_fingerprint;
        if (
          typeof rootFingerprint !== 'number' ||
          !Number.isInteger(rootFingerprint) ||
          rootFingerprint < 0 ||
          rootFingerprint > 0xff_ff_ff_ff
        ) {
          throw new OneKeyLocalError(
            'zcash: device did not return a valid root fingerprint',
          );
        }
        const deviceItems = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async ({ showOnOnekeyFn }) => ({
            success: true as const,
            payload: await this.fetchDeviceViewingKeys({
              deviceParams: params.deviceParams,
              indexes: usedIndexes,
              showOnOnekeyFn,
            }),
          }),
        });
        deviceItems.forEach((item) =>
          reportedFingerprints.add(
            checkIsDefined(item.seedFingerprint).toLowerCase(),
          ),
        );
        const api = await (this.vault as Vault).zcashGetApi();
        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < deviceItems.length; i += 1) {
          const index = usedIndexes[i];
          const { xpub } = await api.deriveTransparentXpubFromUfvk({
            network: ZCASH_NETWORK_MAIN,
            ufvk: checkIsDefined(deviceItems[i].ufvk),
            hdIndex: index,
          });
          const { addresses, publicKeys } = await checkIsDefined(
            this.coreApi,
          ).getAddressFromXpub({
            network,
            xpub,
            relativePaths: [addressRelPath],
          });
          ret.push({
            address: addresses[addressRelPath],
            publicKey: publicKeys[addressRelPath],
            path: this.buildPrepareAccountsPrefixedPath({ template, index }),
            relPath: addressRelPath,
            xpub,
            addresses: { [addressRelPath]: addresses[addressRelPath] },
            __hwExtraInfo__: { rootFingerprint },
          });
        }
        return ret;
      },
    });

    if (reportedFingerprints.size > 1) {
      throw new OneKeyLocalError(
        'zcash: device reported more than one seed fingerprint',
      );
    }
    const [seedFingerprintHex] = [...reportedFingerprints];
    if (seedFingerprintHex && accounts.length > 0) {
      await this.rememberSeedFingerprint({
        walletId: accountUtils.getWalletIdFromAccountId({
          accountId: accounts[0].id,
        }),
        seedFingerprintHex,
      });
    }
    for (const account of accounts) {
      // eslint-disable-next-line no-await-in-loop
      await this.backgroundApi.simpleDb.zcash.initializePrivacyModeOff({
        accountId: account.id,
      });
    }
    return accounts;
  }

  // Device-gated counterpart of KeyringHd.retryLocalWalletSetup: the viewing
  // material comes from the device instead of the seed.
  async retryLocalWalletSetup({
    deviceParams,
  }: {
    deviceParams: IDeviceSharedCallParams;
  }): Promise<void> {
    const accountId = this.vault.accountId;
    const privacyModeState =
      await this.backgroundApi.simpleDb.zcash.getPrivacyModeState({
        accountId,
      });
    if (
      privacyModeState.intent !== 'on' &&
      privacyModeState.operation?.type !== 'enable'
    ) {
      throw new OneKeyLocalError(
        'zcash: privacy mode must be enabled before deriving viewing metadata',
      );
    }
    const account = await this.backgroundApi.serviceAccount.getDBAccount({
      accountId,
    });
    await resolveAndSaveZcashAccountMeta({
      backgroundApi: this.backgroundApi,
      account,
      derive: async ({ hdIndex }) => {
        const [item] = await this.fetchDeviceViewingKeys({
          deviceParams,
          indexes: [hdIndex],
          showOnOnekeyFn: () => false,
        });
        await this.rememberSeedFingerprint({
          walletId: accountUtils.getWalletIdFromAccountId({ accountId }),
          seedFingerprintHex: checkIsDefined(item.seedFingerprint),
        });
        const vault = this.vault as Vault;
        const api = await vault.zcashGetApi();
        const ufvk = checkIsDefined(item.ufvk);
        // The node the user configured, like every other Zcash request.
        const lightwalletdUrl = await vault.zcashResolveLightwalletdUrl();
        const [derived, chainTip] = await Promise.all([
          api.deriveAddressFromUfvk({
            network: ZCASH_NETWORK_MAIN,
            ufvk,
            lightwalletdUrl,
          }),
          api
            .getChainTip({
              network: ZCASH_NETWORK_MAIN,
              lightwalletdUrl,
            })
            .then((tip) =>
              tip !== null
                ? tip
                : fetchZcashChainTipDirect({ lightwalletdUrl }),
            ),
        ]);
        if (derived.transparentAddress !== account.address) {
          throw new OneKeyLocalError(
            'zcash: device viewing key does not match this account',
          );
        }
        if (derived.unifiedAddress === item.address) {
          // Firmware dropped its P2PKH receiver (docs/05 D17): the device now
          // shows the same Orchard-only address the app derives, so there is
          // no second string left to keep.
          console.log('[zcash] device unified address matches app derivation', {
            accountId,
          });
        }
        return {
          ufvk,
          // The device is the address authority for hardware accounts: what
          // it displays is what the user verifies.
          unifiedAddress: item.address,
          derivedUnifiedAddress:
            derived.unifiedAddress === item.address
              ? undefined
              : derived.unifiedAddress,
          transparentAddress: derived.transparentAddress,
          seedFingerprintHex: checkIsDefined(item.seedFingerprint),
          chainTip,
        };
      },
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const encodedTx = parseZcashTransaction(unsignedTx.encodedTx);
    if (encodedTx.zcashMode === 'transparent') {
      return this.signTransparentTransaction({
        encodedTx,
        deviceParams: checkIsDefined(params.deviceParams),
      });
    }
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const accountId = this.vault.accountId;
    const zcashVault = this.vault as Vault;

    const meta = await this.backgroundApi.simpleDb.zcash.getAccountMeta({
      accountId,
    });
    if (!meta) {
      throw new OneKeyLocalError(
        'zcash: shielded account meta missing (use retryLocalWalletSetup to retry)',
      );
    }
    const { pcztHex, pcztReservationId: reservationId } = encodedTx;
    if (!pcztHex || !reservationId) {
      throw new OneKeyLocalError(
        'zcash: unsigned PCZT missing; build and review the transaction again',
      );
    }
    const lifecycleMutex = getZcashLifecycleMutex(meta.ufvk);
    return lifecycleMutex.runExclusive(async () => {
      const privacyModeEnabled =
        await this.backgroundApi.simpleDb.zcash.isPrivacyModeEnabled({
          accountId,
        });
      if (!privacyModeEnabled) {
        throw new OneKeyLocalError(
          'zcash: Privacy Mode was disabled before signing completed',
        );
      }
      let proved: { pcztHex: string };
      try {
        await zcashVault.zcashAssertPcztReservationLive({
          accountId,
          reservationId,
          encodedTx,
        });
        // The device signs a redacted copy of the UNPROVED PCZT and returns
        // only signatures; the original keeps what proving needs.
        const api = await zcashVault.zcashGetApi();
        const device = await api.redactPcztForHardwareSigner({ pcztHex });
        const sdk = await this.getZcashSdk({ connectId });
        const response = await sdk.zcashSignPczt(connectId, deviceId, {
          ...deviceParams.deviceCommonParams,
          pczt: device.pcztHex,
        });
        if (!response.success) {
          throw convertDeviceError(response.payload);
        }
        const combined = await zcashVault.zcashCombineSignedPczt({
          accountId,
          originalPcztHex: pcztHex,
          signedPcztHex: response.payload.pczt,
        });
        proved = await zcashVault.zcashProvePczt({
          accountId,
          pcztHex: combined.pcztHex,
        });
        await zcashVault.zcashCommitSignedPczt({ accountId, reservationId });
      } catch (e) {
        try {
          await zcashVault.zcashAbandonPczt({ accountId, reservationId });
        } catch (releaseError) {
          console.error('[zcash] failed to release abandoned PCZT inputs', {
            accountId,
            releaseError,
          });
        }
        throw e;
      }
      const signedEncodedTx: IEncodedTxZcash = {
        ...encodedTx,
        signedPcztHex: proved.pcztHex,
        pcztReservationId: reservationId,
      };
      return {
        txid: '',
        rawTx: proved.pcztHex,
        encodedTx: signedEncodedTx,
      };
    });
  }

  // Accounts added before the fingerprint was kept ask the device once; the
  // viewing key it returns must still derive this account's xpub.
  private async resolveSeedFingerprint({
    deviceParams,
    accountIndex,
    network,
    accountXpub,
  }: {
    deviceParams: IDeviceSharedCallParams;
    accountIndex: number;
    network: IZcashTransparentTxRequest['network'];
    accountXpub: string;
  }): Promise<string> {
    const walletId = accountUtils.getWalletIdFromAccountId({
      accountId: this.vault.accountId,
    });
    const stored =
      await this.backgroundApi.simpleDb.zcash.getWalletSeedFingerprint({
        walletId,
      });
    if (stored) {
      return stored;
    }
    const [viewingKeys] = await this.fetchDeviceViewingKeys({
      deviceParams,
      indexes: [accountIndex],
      showOnOnekeyFn: () => false,
    });
    const api = await (this.vault as Vault).zcashGetApi();
    const { xpub } = await api.deriveTransparentXpubFromUfvk({
      network,
      ufvk: checkIsDefined(viewingKeys.ufvk),
      hdIndex: accountIndex,
    });
    if (xpub !== accountXpub) {
      throw new OneKeyLocalError(
        'zcash: device viewing key does not match this account',
      );
    }
    const seedFingerprintHex = checkIsDefined(
      viewingKeys.seedFingerprint,
    ).toLowerCase();
    await this.rememberSeedFingerprint({ walletId, seedFingerprintHex });
    return seedFingerprintHex;
  }

  private async signTransparentTransaction({
    encodedTx,
    deviceParams,
  }: {
    encodedTx: IEncodedTxZcash;
    deviceParams: IDeviceSharedCallParams;
  }): Promise<ISignedTxPro> {
    const accountId = this.vault.accountId;
    const vault = this.vault as Vault;
    const request = await vault.zcashPrepareFreshTransparentRequest({
      encodedTx,
    });
    const account = await this.backgroundApi.serviceAccount.getDBAccount({
      accountId,
    });
    const accountXpub = 'xpub' in account ? account.xpub : undefined;
    if (account.pathIndex !== request.accountIndex || !accountXpub) {
      throw new OneKeyLocalError('zcash: hardware signing account changed');
    }
    return signTransparentTransaction({
      journal: this.backgroundApi.simpleDb.zcash,
      accountId,
      encodedTx,
      request,
      parseOutputs: (result) => vault.zcashParseTransparentOutputs(result),
      sign: async () => {
        const api = await vault.zcashGetApi();
        const seedFingerprintHex = await this.resolveSeedFingerprint({
          deviceParams,
          accountIndex: request.accountIndex,
          network: request.network,
          accountXpub,
        });
        // The firmware checks every input's seed fingerprint and pubkey
        // against its own seed, so a different device refuses to sign.
        const original = await api.createTransparentHardwarePczt({
          request,
          accountXpub,
          seedFingerprintHex,
        });
        const device = await api.redactPcztForHardwareSigner({
          pcztHex: original.pcztHex,
        });
        const { connectId, deviceId } = deviceParams.dbDevice;
        const sdk = await this.getZcashSdk({ connectId });
        const response = await sdk.zcashSignPczt(connectId, deviceId, {
          ...deviceParams.deviceCommonParams,
          pczt: device.pcztHex,
        });
        if (!response.success) {
          throw convertDeviceError(response.payload);
        }
        const result = await api.finalizeTransparentHardwarePczt({
          request,
          accountXpub,
          originalPcztHex: original.pcztHex,
          signedPcztHex: response.payload.pczt,
        });
        if (
          !(await this.backgroundApi.serviceAccount.getDBAccountSafe({
            accountId,
          }))
        ) {
          throw new OneKeyLocalError('zcash: account removed during signing');
        }
        return result;
      },
    });
  }

  override signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }
}
