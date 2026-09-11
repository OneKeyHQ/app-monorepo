import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  ZCASH_LIGHTWALLETD_MAINNET,
  ZCASH_NETWORK_MAIN,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/constants';
import { fetchZcashChainTipDirect } from '@onekeyhq/core/src/chains/zcash/sdkZcash/impl/chainTipDirect';
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
import type {
  IDeviceCommonParams,
  IDeviceResponse,
  IDeviceSharedCallParams,
} from '@onekeyhq/shared/types/device';

import { KeyringHardwareBase } from '../../base/KeyringHardwareBase';

import { resolveAndSaveZcashAccountMeta } from './accountMeta';
import { getZcashLifecycleMutex } from './lifecycle';

import type { IEncodedTxZcash, IZcashVaultPcztApi } from './types';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IBuildPrepareAccountsPrefixedPathParams,
  IPrepareHardwareAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

// ZIP-32 account path the device derives shielded keys from.
const buildZcashShieldedPath = (index: number) => `m/32'/133'/${index}'`;

type IZcashDeviceUnifiedAddress = {
  path: string;
  address: string;
  ufvk?: string;
  seedFingerprint?: string;
};

// hd-core methods added for zcash (ZcashGetUnifiedAddress / ZcashSignPczt,
// protocol V2 only). Typed locally until the SDK release carrying them is
// pinned by the app.
type IZcashHardwareSdk = {
  zcashGetUnifiedAddress: (
    connectId: string,
    deviceId: string,
    params: Partial<IDeviceCommonParams> & {
      bundle: Array<{
        path: string;
        showOnOneKey?: boolean;
        includeUfvk?: boolean;
        includeSeedFingerprint?: boolean;
      }>;
    },
  ) => IDeviceResponse<IZcashDeviceUnifiedAddress[]>;
  zcashSignPczt: (
    connectId: string,
    deviceId: string,
    params: Partial<IDeviceCommonParams> & { pczt: string },
  ) => IDeviceResponse<{ pczt: string }>;
};

export class KeyringHardware extends KeyringHardwareBase {
  override coreApi = coreChainApi.zec.hd;

  private async getZcashSdk({ connectId }: { connectId: string }) {
    const sdk = await this.getHardwareSDKInstance({ connectId });
    return sdk as unknown as IZcashHardwareSdk;
  }

  private async getZcashApi() {
    const zcashSdk = (
      await import('@onekeyhq/core/src/chains/zcash/sdkZcash/sdk')
    ).default;
    return zcashSdk.getZcashApi();
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
  }): Promise<IZcashDeviceUnifiedAddress[]> {
    const { connectId, deviceId } = deviceParams.dbDevice;
    const sdk = await this.getZcashSdk({ connectId });
    const response = await sdk.zcashGetUnifiedAddress(connectId, deviceId, {
      ...deviceParams.deviceCommonParams,
      bundle: indexes.map((index, arrIndex) => ({
        path: buildZcashShieldedPath(index),
        showOnOneKey: showOnOnekeyFn(arrIndex) ?? false,
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

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<IDBAccount[]> {
    const networkInfo = await this.getCoreApiNetworkInfo();
    const network = getBtcForkNetwork(networkInfo.networkChainCode);
    const addressRelPath = accountUtils.buildUtxoAddressRelPath();
    const { template } = params.deriveInfo;

    const accounts = await this.basePrepareHdUtxoAccounts(params, {
      buildAddressesInfo: async ({ usedIndexes }) => {
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
        const api = await this.getZcashApi();
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
            __hwExtraInfo__: undefined,
          });
        }
        return ret;
      },
    });

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
        const api = await this.getZcashApi();
        const ufvk = checkIsDefined(item.ufvk);
        const [derived, chainTip] = await Promise.all([
          api.deriveAddressFromUfvk({
            network: ZCASH_NETWORK_MAIN,
            ufvk,
            lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
          }),
          api
            .getChainTip({
              network: ZCASH_NETWORK_MAIN,
              lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
            })
            .then((tip) =>
              tip !== null
                ? tip
                : fetchZcashChainTipDirect({
                    lightwalletdUrl: ZCASH_LIGHTWALLETD_MAINNET,
                  }),
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
    const encodedTx = unsignedTx.encodedTx as IEncodedTxZcash;
    if (encodedTx.zcashMode === 'transparent') {
      // The keys runtime assembles transparent txs from the seed; the device
      // needs per-input sighashes, which it does not expose yet.
      throw new NotImplemented(
        'Zcash transparent sends from hardware are not supported yet',
      );
    }
    const deviceParams = checkIsDefined(params.deviceParams);
    const { connectId, deviceId } = deviceParams.dbDevice;
    const accountId = this.vault.accountId;
    const zcashVault = this.vault as unknown as IZcashVaultPcztApi;

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
        });
        // The device signs the UNPROVED PCZT (proof fields make it reject)
        // and returns a redacted copy carrying only the signatures.
        const sdk = await this.getZcashSdk({ connectId });
        const response = await sdk.zcashSignPczt(connectId, deviceId, {
          ...deviceParams.deviceCommonParams,
          pczt: pcztHex,
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

  override signMessage(
    _params: ISignMessageParams,
  ): Promise<ISignedMessagePro> {
    throw new NotImplemented();
  }
}
