/* eslint-disable @typescript-eslint/no-unused-vars */

import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import * as engineUtils from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError } from '../../../errors';
import * as OneKeyHardware from '../../../hardware';
import { slicePathTemplate } from '../../../managers/derivation';
import {
  getAccountNameInfoByImpl,
  getAccountNameInfoByTemplate,
} from '../../../managers/impl';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { ethers } from './sdk/ethers';

import type { DBSimpleAccount } from '../../../types/account';
import type {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type { IUnsignedMessageEvm } from './Vault';

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const path = await this.getAccountPath();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    return OneKeyHardware.ethereumSignTransaction(
      HardwareSDK,
      connectId,
      deviceId,
      path,
      chainId,
      unsignedTx,
      passphraseState,
    );
  }

  async signMessage(
    messages: IUnsignedMessageEvm[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const path = await this.getAccountPath();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    return Promise.all(
      messages.map((message) =>
        OneKeyHardware.ethereumSignMessage({
          HardwareSDK,
          connectId,
          deviceId,
          passphraseState,
          path,
          message,
          chainId: Number(chainId),
        }),
      ),
    );
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const { indexes, names, type, template, coinType } = params;

    const { pathPrefix, pathSuffix } = slicePathTemplate(template);

    const accountNameInfos = await this.vault.getAccountNameInfoMap();
    const isLedgerLive = template === accountNameInfos.ledgerLive.template;

    const paths = indexes.map(
      (index) => `${pathPrefix}/${pathSuffix.replace('{index}', `${index}`)}`,
    );

    let addressInfos;
    if (type === 'SEARCH_ACCOUNTS') {
      // When searching for accounts, we only get the PATH_PREFIX's xpub
      // and derive the addresses to reduce the number of calls to the device
      // therefore better performance.
      let response;
      let publicKeyParams: any = {
        path: pathPrefix,
        showOnOneKey: false,
        chainId: Number(chainId),
      };
      if (isLedgerLive) {
        publicKeyParams = {
          bundle: paths.map((path) => ({
            path,
            showOnOneKey: false,
            chainId: Number(chainId),
          })),
          useBatch: true,
        };
      }
      try {
        response = await HardwareSDK.evmGetPublicKey(connectId, deviceId, {
          ...publicKeyParams,
          ...passphraseState,
        });
      } catch (e: any) {
        debugLogger.engine.error(e);
        throw new OneKeyHardwareError(e);
      }

      if (!response.success) {
        throw convertDeviceError(response.payload);
      }

      if (isLedgerLive) {
        addressInfos = await Promise.all(
          (
            response.payload as unknown as {
              path: string;
              publicKey: string;
            }[]
          ).map(async (item) => ({
            path: item.path,
            info: engineUtils.fixAddressCase({
              address: await this.engine.providerManager.addressFromPub(
                this.networkId,
                item.publicKey,
              ),
              impl: IMPL_EVM,
            }),
          })),
        );
      } else {
        const { xpub } = response.payload;
        const node = ethers.utils.HDNode.fromExtendedKey(xpub);
        addressInfos = indexes.map((index) => ({
          path: `${pathPrefix}/${pathSuffix.replace('{index}', `${index}`)}`,
          info: engineUtils.fixAddressCase({
            address: node.derivePath(`${index}`).address,
            impl: IMPL_EVM,
          }),
        }));
      }
    } else {
      addressInfos = await OneKeyHardware.getXpubs(
        HardwareSDK,
        IMPL_EVM,
        paths,
        'address',
        type,
        connectId,
        deviceId,
        passphraseState,
        Number(chainId),
      );
    }

    const ret = [];
    let index = 0;
    const impl = await this.getNetworkImpl();
    const { prefix } = getAccountNameInfoByTemplate(impl, template);
    const isLedgerLiveTemplate =
      getAccountNameInfoByImpl(impl).ledgerLive.template === template;
    for (const info of addressInfos) {
      const { path, info: address } = info;
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
      ret.push({
        id: isLedgerLiveTemplate
          ? // because the first account path of ledger live template is the same as the bip44 account path
            `${this.walletId}--${path}--LedgerLive`
          : `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType,
        pub: '',
        address,
        template,
      });
      index += 1;
    }

    return ret;
  }

  async getAddress(params: IGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const address = await OneKeyHardware.ethereumGetAddress(
      HardwareSDK,
      connectId,
      deviceId,
      params.path,
      params.showOnOneKey,
      passphraseState,
      Number(chainId),
    );

    return address;
  }

  override async batchGetAddress(
    params: IGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.evmGetAddress(connectId, deviceId, {
      ...passphraseState,
      bundle: params.map(({ path, showOnOneKey }) => ({
        path,
        showOnOneKey: !!showOnOneKey,
        chainId: Number(chainId),
      })),
    });

    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    return response.payload.map((item) => ({
      path: item.path ?? '',
      address: item.address ?? '',
    }));
  }
}
