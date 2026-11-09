import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { isShieldedAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { ZCASH_NETWORK_MAIN } from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { getSupportedZcashUnifiedAddressReceiverTypes } from '@onekeyhq/core/src/chains/zcash/sdkZcash/unifiedAddress';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  ICoreApiGetAddressItem,
  ISignedMessagePro,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import { NotImplemented, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  convertDeviceError,
  isHardwareErrorByCode,
  isOneKeyHardwareError,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IDeviceSharedCallParams } from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';
import { ensureLocalWalletPrivacyAvailable } from '../../localWallet/remoteConfig';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import { getZcashHardwareSdk } from './hardwareSdk';
import { getZcashLifecycleMutex } from './lifecycle';
import { getZcashPcztReviewRequest } from './pcztReview';
import { signTransparentTransaction } from './signTransparentTransaction';
import { parseZcashTransaction } from './transactionReview';
import { zcashTrackUserOperation } from './vaultUtils';

import type { IZcashHardwareAddress } from './hardwareSdk';
import type { IEncodedTxZcash } from './types';
import type Vault from './Vault';
import type { IDBAccount, IDBUtxoAccount } from '../../../dbs/local/types';
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

// Temporary: Pro 2 firmware has no Zcash coin yet; Bitcoin's xpub format is the same.
const TRANSPARENT_XPUB_COIN = 'btc';

// How firmware without the Zcash app answers a Zcash message: Pro 2, then Trezor-based firmware.
const FIRMWARE_WITHOUT_ZCASH_MESSAGES = [
  'No handler for type',
  'Unknown message',
];

function isFirmwareWithoutZcashError(error: unknown): error is IOneKeyError {
  if (!isOneKeyHardwareError(error)) {
    return false;
  }
  const needsUpgrade = isHardwareErrorByCode({
    error,
    code: HardwareErrorCode.CallMethodNeedUpgradeFirmware,
  });
  if (needsUpgrade) {
    return true;
  }
  const message = error.payload?.message ?? '';
  return FIRMWARE_WITHOUT_ZCASH_MESSAGES.some((text) => message.includes(text));
}

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.zec.hd;

  // The transparent account comes from the BTC public-key call, without a device prompt.
  override hwSdkNetwork: IHwSdkNetwork = 'btc';

  override async buildHwAllNetworkPrepareAccountsParams({
    template,
    index,
  }: IBuildHwAllNetworkPrepareAccountsParams): Promise<
    AllNetworkAddressParams | undefined
  > {
    return {
      network: this.hwSdkNetwork,
      chainName: TRANSPARENT_XPUB_COIN,
      path: this.buildPrepareAccountsPrefixedPath({ template, index }),
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

  // Proves the device holds this account's seed (its first transparent address) and keeps the
  // seed fingerprint, without a device prompt; the Orchard UA comes back when asked for.
  private async verifyDeviceAccount({
    deviceParams,
    accountIndex,
    accountAddress,
    includeUnifiedAddress,
  }: {
    deviceParams: IDeviceSharedCallParams;
    accountIndex: number;
    accountAddress: string;
    includeUnifiedAddress: boolean;
  }): Promise<{ seedFingerprintHex: string; unifiedAddress?: string }> {
    const { connectId, deviceId } = deviceParams.dbDevice;
    const sdk = await this.getZcashSdk({ connectId });
    const request = (addressType: 1 | 2) => ({
      path: buildZcashShieldedPath(accountIndex),
      showOnOneKey: false,
      addressType,
      scope: 0,
      diversifierIndex: 0,
      includeSeedFingerprint: true,
    });
    const bundle = [request(1)];
    if (includeUnifiedAddress) {
      bundle.push(request(2));
    }
    const response = await sdk.zcashGetAddress(connectId, deviceId, {
      ...deviceParams.deviceCommonParams,
      bundle,
    });
    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    const items = response.payload;
    if (items.length !== bundle.length) {
      throw new OneKeyLocalError(
        'zcash: device returned unexpected address count',
      );
    }
    const [transparent, unified] = items;
    if (transparent.address !== accountAddress) {
      throw new OneKeyLocalError(
        'zcash: device seed does not match this account',
      );
    }
    const fingerprints = new Set(
      items.map((item) => item.seedFingerprint?.toLowerCase()),
    );
    const [seedFingerprintHex] = [...fingerprints];
    if (fingerprints.size !== 1 || !seedFingerprintHex) {
      throw new OneKeyLocalError(
        'zcash: device did not return one seed fingerprint',
      );
    }
    // Account creation has no account id yet, only the wallet.
    await this.rememberSeedFingerprint({
      walletId: this.walletId,
      seedFingerprintHex,
    });
    return { seedFingerprintHex, unifiedAddress: unified?.address };
  }

  // Older firmware returns this path's BTC public key but cannot sign Zcash. A wallet's first
  // Zcash account asks the device once; the saved seed fingerprint answers later ones.
  private async ensureDeviceHasZcash({
    deviceParams,
    account,
  }: {
    deviceParams: IDeviceSharedCallParams;
    account: IDBUtxoAccount;
  }): Promise<void> {
    const stored =
      await this.backgroundApi.simpleDb.privacyChainState.getZcashWalletSeedFingerprint(
        {
          walletId: this.walletId,
        },
      );
    if (stored) {
      return;
    }
    try {
      await this.verifyDeviceAccount({
        deviceParams,
        accountIndex: checkIsDefined(account.pathIndex),
        accountAddress: account.address,
        includeUnifiedAddress: false,
      });
    } catch (error) {
      if (!isFirmwareWithoutZcashError(error)) {
        throw error;
      }
      // Coded as unsupported so account creation skips Zcash instead of stopping.
      throw convertDeviceError({
        ...error.payload,
        code: HardwareErrorCode.DeviceNotSupportMethod,
      });
    }
  }

  private async fetchDeviceUfvk({
    deviceParams,
    accountIndex,
  }: {
    deviceParams: IDeviceSharedCallParams;
    accountIndex: number;
  }): Promise<string> {
    const { connectId, deviceId } = deviceParams.dbDevice;
    const sdk = await this.getZcashSdk({ connectId });
    const response = await sdk.zcashGetFullViewingKey(connectId, deviceId, {
      ...deviceParams.deviceCommonParams,
      path: buildZcashShieldedPath(accountIndex),
    });
    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    return response.payload.ufvk;
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

    const accounts = await this.basePrepareHdUtxoAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
        const publicKeys = await this.baseGetDeviceAccountPublicKeys({
          params,
          usedIndexes,
          sdkGetPublicKeysFn: async () => {
            const allNetworkAccounts = await this.getAllNetworkPrepareAccounts({
              params,
              usedIndexes,
              hwSdkNetwork: this.hwSdkNetwork,
              buildPath: ({ index }) =>
                this.buildPrepareAccountsPrefixedPath({ template, index }),
              buildResultAccount: ({ account }) => ({
                path: account.path,
                xpub: account.payload?.xpub || '',
                __hwExtraInfo__: undefined,
              }),
            });
            if (allNetworkAccounts) {
              return allNetworkAccounts;
            }
            throw new OneKeyLocalError('use sdk allNetworkGetAddress instead');
          },
        });
        const ret: ICoreApiGetAddressItem[] = [];
        for (let i = 0; i < publicKeys.length; i += 1) {
          const { path, xpub, __hwExtraInfo__ } = publicKeys[i];
          const { addresses, publicKeys: publicKeysMap } = await checkIsDefined(
            this.coreApi,
          ).getAddressFromXpub({
            network,
            xpub,
            relativePaths: [addressRelPath],
          });
          ret.push({
            address: addresses[addressRelPath],
            publicKey: publicKeysMap[addressRelPath],
            path,
            relPath: addressRelPath,
            xpub,
            addresses: { [addressRelPath]: addresses[addressRelPath] },
            __hwExtraInfo__,
          });
        }
        return ret;
      },
    });
    const [firstAccount] = accounts;
    if (firstAccount) {
      await this.ensureDeviceHasZcash({
        deviceParams: params.deviceParams,
        account: firstAccount,
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
        // Checked before the UFVK export so another seed never asks for a confirmation.
        const { seedFingerprintHex, unifiedAddress } =
          await this.verifyDeviceAccount({
            deviceParams,
            accountIndex: hdIndex,
            accountAddress: account.address,
            includeUnifiedAddress: true,
          });
        const deviceUnifiedAddress = checkIsDefined(unifiedAddress);
        const ufvk = await this.fetchDeviceUfvk({
          deviceParams,
          accountIndex: hdIndex,
        });
        const vault = this.vault as Vault;
        const api = await vault.zcashGetApi();
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
          unifiedAddress: deviceUnifiedAddress,
          derivedUnifiedAddress:
            derived.unifiedAddress === deviceUnifiedAddress
              ? undefined
              : derived.unifiedAddress,
          transparentAddress: derived.transparentAddress,
          seedFingerprintHex,
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

  // A missing fingerprint asks the device without a prompt. A shielded payment uses the UFVK
  // stored by privacy setup to keep its outputs recoverable; without one it is sent unsealed
  // rather than asking the device to export the key.
  private async resolveSigningViewingKeys({
    deviceParams,
    accountIndex,
    accountAddress,
    needsUfvk,
  }: {
    deviceParams: IDeviceSharedCallParams;
    accountIndex: number;
    accountAddress: string;
    needsUfvk: boolean;
  }): Promise<{ seedFingerprintHex: string; ufvk?: string }> {
    const accountId = this.vault.accountId;
    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    const [stored, ufvk] = await Promise.all([
      this.backgroundApi.simpleDb.privacyChainState.getZcashWalletSeedFingerprint(
        {
          walletId,
        },
      ),
      needsUfvk
        ? (this.vault as Vault).zcashGetStoredUfvk({ accountId })
        : undefined,
    ]);
    if (stored) {
      return { seedFingerprintHex: stored, ufvk };
    }
    const { seedFingerprintHex } = await this.verifyDeviceAccount({
      deviceParams,
      accountIndex,
      accountAddress,
      includeUnifiedAddress: false,
    });
    return { seedFingerprintHex, ufvk };
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
            accountAddress: account.address,
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
