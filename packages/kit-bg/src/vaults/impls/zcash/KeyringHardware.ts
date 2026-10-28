import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { isShieldedAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { ZCASH_NETWORK_MAIN } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import type { IZcashTransparentTxRequest } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import { getSupportedZcashUnifiedAddressReceiverTypes } from '@onekeyhq/core/src/chains/zcash/sdkZcash/unifiedAddress';
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
import { ensureLocalWalletPrivacyAvailable } from '../../localWallet/remoteConfig';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import {
  getZcashHardwareSdk,
  parseZcashAllNetworkAddress,
} from './hardwareSdk';
import { getZcashLifecycleMutex } from './lifecycle';
import { getZcashPcztReviewRequest } from './pcztReview';
import { signTransparentTransaction } from './signTransparentTransaction';
import { parseZcashTransaction } from './transactionReview';
import { zcashTrackUserOperation } from './vaultUtils';

import type { IZcashHardwareAddress } from './hardwareSdk';
import type { IEncodedTxZcash } from './types';
import type Vault from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildHwAllNetworkPrepareAccountsParams,
  IBuildPrepareAccountsPrefixedPathParams,
  IHwSdkNetwork,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';
import type { AllNetworkAddressParams } from '@onekeyfe/hd-core';

// ZIP-32 account path the device derives shielded keys from.
const buildZcashShieldedPath = (index: number) => `m/32'/133'/${index}'`;

function assertViewingKeys(items: IZcashHardwareAddress[]) {
  for (const item of items) {
    if (!item.ufvk || !item.seedFingerprint) {
      throw new OneKeyLocalError(
        'zcash: device did not return the viewing key for this account',
      );
    }
  }
}

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.zec.hd;

  override hwSdkNetwork: IHwSdkNetwork = 'zcash';

  override async buildHwAllNetworkPrepareAccountsParams(
    params: IBuildHwAllNetworkPrepareAccountsParams,
  ): Promise<AllNetworkAddressParams | undefined> {
    return {
      network: this.hwSdkNetwork,
      path: buildZcashShieldedPath(params.index),
      showOnOneKey: false,
    };
  }

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

  // One device round trip returns UA, UFVK and seed fingerprint per account index; the transparent account is rebuilt from the UFVK.
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
    assertViewingKeys(items);
    return items;
  }

  // One seed per hardware wallet, so one fingerprint; a device reporting another does not hold this seed.
  private async rememberSeedFingerprint({
    walletId,
    seedFingerprintHex,
  }: {
    walletId: string;
    seedFingerprintHex: string;
  }): Promise<void> {
    const reported = seedFingerprintHex.toLowerCase();
    const stored =
      await this.backgroundApi.simpleDb.privacyChainState.getZcashWalletSeedFingerprint(
        {
          walletId,
        },
      );
    if (stored === reported) {
      return;
    }
    if (stored) {
      throw new OneKeyLocalError(
        'zcash: device seed does not match this wallet',
      );
    }
    await this.backgroundApi.simpleDb.privacyChainState.saveZcashWalletSeedFingerprint(
      {
        walletId,
        seedFingerprintHex: reported,
      },
    );
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
        let addressType: 0 | 1 | 2 = isPrivate ? 2 : 1;
        const expectedAddress = params.chainExtraParams?.expectedAddress;
        if (isPrivate && expectedAddress !== undefined) {
          const receivers =
            getSupportedZcashUnifiedAddressReceiverTypes(expectedAddress);
          // The private tab can show a legacy mixed UA or an Orchard-only UA.
          if (
            receivers?.length === 2 &&
            receivers[0] === 0 &&
            receivers[1] === 3
          ) {
            addressType = 0;
          } else if (receivers?.length !== 1 || receivers[0] !== 3) {
            throw new OneKeyLocalError(
              'zcash: unsupported address verification receivers',
            );
          }
        }
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
            addressType,
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
        const deviceItems = await this.baseGetDeviceAccountAddresses({
          params,
          usedIndexes,
          sdkGetAddressFn: async () => {
            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              buildPath: ({ index }) => buildZcashShieldedPath(index),
              buildResultAccount: ({ account }) => ({
                ...parseZcashAllNetworkAddress(account),
                __hwExtraInfo__: undefined,
              }),
              hwSdkNetwork: this.hwSdkNetwork,
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }
            throw new OneKeyLocalError('use sdk allNetworkGetAddress instead');
          },
        });
        assertViewingKeys(deviceItems);
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
            __hwExtraInfo__: deviceItems[i].__hwExtraInfo__,
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
    return accounts;
  }

  // Device-gated counterpart of KeyringHd.retryLocalWalletSetup.
  async retryLocalWalletSetup({
    deviceParams,
    forceDerivation,
  }: {
    deviceParams: IDeviceSharedCallParams;
    forceDerivation?: boolean;
  }): Promise<void> {
    const accountId = this.vault.accountId;
    const privacyModeState =
      await this.backgroundApi.simpleDb.privacyChainState.getZcashPrivacyModeState(
        {
          accountId,
        },
      );
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
      networkId: this.vault.networkId,
      account,
      forceDerivation,
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
        const lightwalletdUrl = await vault.zcashResolveLightwalletdUrl();
        const derived = await api.deriveAddressFromUfvk({
          network: ZCASH_NETWORK_MAIN,
          ufvk,
          lightwalletdUrl,
        });
        if (derived.transparentAddress !== account.address) {
          throw new OneKeyLocalError(
            'zcash: device viewing key does not match this account',
          );
        }
        return {
          ufvk,
          // The device is the address authority for hardware accounts.
          unifiedAddress: item.address,
          derivedUnifiedAddress:
            derived.unifiedAddress === item.address
              ? undefined
              : derived.unifiedAddress,
          transparentAddress: derived.transparentAddress,
          seedFingerprintHex: checkIsDefined(item.seedFingerprint),
          chainTip: null,
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
    const privacyContext = {
      backgroundApi: this.backgroundApi,
      networkId: this.vault.networkId,
    };
    await ensureLocalWalletPrivacyAvailable(privacyContext);
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const accountId = this.vault.accountId;
    const zcashVault = this.vault as Vault;

    const meta =
      await this.backgroundApi.simpleDb.privacyChainState.getZcashAccountMeta({
        accountId,
      });
    if (!meta) {
      throw new OneKeyLocalError(
        'zcash: shielded account meta missing (use retryLocalWalletSetup to retry)',
      );
    }
    const { pcztHex } = encodedTx;
    if (!pcztHex) {
      throw new OneKeyLocalError(
        'zcash: unsigned PCZT missing; build and review the transaction again',
      );
    }
    const ufvk = await zcashVault.zcashGetAccountUfvk({ accountId, meta });
    const lifecycleMutex = getZcashLifecycleMutex(meta.vkFp);
    return lifecycleMutex.runExclusive(async () => {
      await ensureLocalWalletPrivacyAvailable(privacyContext);
      const privacyModeEnabled =
        await this.backgroundApi.simpleDb.privacyChainState.isZcashPrivacyModeEnabled(
          {
            accountId,
          },
        );
      if (!privacyModeEnabled) {
        throw new OneKeyLocalError(
          'zcash: Privacy Mode was disabled before signing completed',
        );
      }
      const api = await zcashVault.zcashGetApi();
      // The host refuses a PCZT that differs from the reviewed one before asking the device to sign.
      await api.verifyPcztReview({
        pcztHex,
        review: getZcashPcztReviewRequest(encodedTx, ufvk),
      });
      // The device signs a redacted copy and returns only signatures; the original keeps what proving needs.
      const device = await api.redactPcztForHardwareSigner({ pcztHex });
      const sdk = await this.getZcashSdk({ connectId });
      await ensureLocalWalletPrivacyAvailable(privacyContext);
      const response = await sdk.zcashSignPczt(connectId, deviceId, {
        ...deviceParams.deviceCommonParams,
        pczt: device.pcztHex,
      });
      if (!response.success) {
        throw convertDeviceError(response.payload);
      }
      await ensureLocalWalletPrivacyAvailable(privacyContext);
      const combined = await zcashVault.zcashCombineSignedPczt({
        accountId,
        originalPcztHex: pcztHex,
        signedPcztHex: response.payload.pczt,
      });
      const proved = await zcashVault.zcashProvePczt({
        accountId,
        pcztHex: combined.pcztHex,
      });
      await ensureLocalWalletPrivacyAvailable(privacyContext);
      const signedEncodedTx: IEncodedTxZcash = {
        ...encodedTx,
        signedPcztHex: proved.pcztHex,
      };
      return {
        txid: '',
        rawTx: proved.pcztHex,
        encodedTx: signedEncodedTx,
      };
    });
  }

  // A missing fingerprint (accounts added before it was kept) or a shielded payment's UFVK with
  // none stored asks the device once; the returned key must derive this account's xpub.
  private async resolveSigningViewingKeys({
    deviceParams,
    accountIndex,
    network,
    accountXpub,
    needsUfvk,
  }: {
    deviceParams: IDeviceSharedCallParams;
    accountIndex: number;
    network: IZcashTransparentTxRequest['network'];
    accountXpub: string;
    needsUfvk: boolean;
  }): Promise<{ seedFingerprintHex: string; ufvk?: string }> {
    const accountId = this.vault.accountId;
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    const [stored, storedUfvk] = await Promise.all([
      this.backgroundApi.simpleDb.privacyChainState.getZcashWalletSeedFingerprint(
        {
          walletId,
        },
      ),
      needsUfvk
        ? (this.vault as Vault).zcashGetStoredUfvk({ accountId })
        : undefined,
    ]);
    if (stored && (!needsUfvk || storedUfvk)) {
      return { seedFingerprintHex: stored, ufvk: storedUfvk };
    }
    const [viewingKeys] = await this.fetchDeviceViewingKeys({
      deviceParams,
      indexes: [accountIndex],
      showOnOnekeyFn: () => false,
    });
    const ufvk = checkIsDefined(viewingKeys.ufvk);
    const api = await (this.vault as Vault).zcashGetApi();
    const { xpub } = await api.deriveTransparentXpubFromUfvk({
      network,
      ufvk,
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
    return { seedFingerprintHex, ufvk: needsUfvk ? ufvk : undefined };
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
      journal: this.backgroundApi.simpleDb.privacyChainJournal,
      sentStore: this.backgroundApi.simpleDb.privacyChainZcashSent,
      accountId,
      encodedTx,
      request,
      parseOutputs: (result) => vault.zcashParseTransparentOutputs(result),
      sign: async () => {
        const api = await vault.zcashGetApi();
        // A shielded payment is sealed to the account's OVK so this wallet can recover it.
        const { seedFingerprintHex, ufvk } =
          await this.resolveSigningViewingKeys({
            deviceParams,
            accountIndex: request.accountIndex,
            network: request.network,
            accountXpub,
            needsUfvk: request.recipients.some(({ address }) =>
              isShieldedAddress(address),
            ),
          });
        // The firmware checks each input's seed fingerprint and pubkey, so a different device refuses to sign.
        const original = await api.createTransparentHardwarePczt({
          request,
          accountXpub,
          seedFingerprintHex,
          ufvk,
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
        const result = await zcashTrackUserOperation(() =>
          api.finalizeTransparentHardwarePczt({
            request,
            accountXpub,
            originalPcztHex: original.pcztHex,
            signedPcztHex: response.payload.pczt,
            ufvk,
          }),
        );
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
