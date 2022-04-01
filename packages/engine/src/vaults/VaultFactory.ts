/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, new-cap */

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { IMPL_CFX, IMPL_EVM } from '../constants';
import { OneKeyInternalError } from '../errors';
import { IVaultOptions } from '../types/vault';

import VaultCfx from './impl/cfx/Vault';
import VaultEvm from './impl/evm/Vault';

import type { Engine } from '../index';
import type { IVaultFactoryOptions } from '../types/vault';
import type { KeyringBase } from './keyring/KeyringBase';
import type { VaultBase } from './VaultBase';

/*

UI -> backgroundApiProxy -> backgroundService ->
- Engine
  - proxy
  - chain-libs
- vaults ( proxy alternative )
  - VaultEvm <- VaultBase
    - keyring
      - KeyringHd <- KeyringHdBase <- KeyringBase
        - chain-libs
        - proxy
      - KeyringHardware <- KeyringHardwareBase <- KeyringBase
        - hardware
  - VaultCfx
    - keyring
      - KeyringHd <- KeyringHdBase <- KeyringBase
      - KeyringHardware <- KeyringHardwareBase <- KeyringBase

// ----------------------------------------------

// evm HD
$backgroundApiProxy.backgroundApi.engine.transfer0({"password":"11111111","networkId":"evm--97","accountId":"hd-1--m/44'/60'/0'/0/0","to":"0x76f3f64cb3cd19debee51436df630a342b736c24","value":"0.0003","gasPrice":"15","gasLimit":"21000","tokenIdOnNetwork":""})

// evm WATCHING
$backgroundApiProxy.backgroundApi.engine.transfer0({"password":"11111111","networkId":"evm--97","accountId":"watching--60--0xee226379db83cffc681495730c11fdde79ba4c0c","to":"0x76f3f64cb3cd19debee51436df630a342b736c24","value":"0.0003","gasPrice":"15","gasLimit":"21000","tokenIdOnNetwork":""})

// cfx HD
$backgroundApiProxy.backgroundApi.engine.transfer0({"password":"11111111","networkId":"cfx--1","accountId":"hd-1--m/44'/503'/0'/0/0","to":"cfxtest:aakd3vxbwbxbw0hwj3ww5ca67gn43mz2ra5f3s8brv","value":"0.0003","gasPrice":"15","gasLimit":"21000","tokenIdOnNetwork":""})
 */

// TODO debugLogger
// TODO simulate hardware account, solana account
export class VaultFactory {
  constructor({ engine }: { engine: Engine }) {
    this.engine = engine;
  }

  lastVault: VaultBase | null = null;

  engine: Engine;

  createKeyringInstance = async (vault: VaultBase) => {
    /*
     const dbAccount = await this.engine.dbApi.getAccount(
       // "hd-1--m/44'/60'/0'/0/0"
       this.options.accountId,
     );
     // "hd-1--m/44'/60'/0'/0/0"
     const accountId = dbAccount.id;
   */
    const { accountId } = vault;
    // const dbAccount = await this.getDbAccount();
    let keyring: KeyringBase | null = null;
    // TODO dbAccount type: "simple"
    if (accountId.startsWith('hd-')) {
      keyring = new vault.keyringMap.hd(vault);
    }
    if (accountId.startsWith('hw-')) {
      keyring = new vault.keyringMap.hw(vault);
    }
    if (accountId.startsWith('watching-')) {
      keyring = new vault.keyringMap.watching(vault);
    }
    if (accountId.startsWith('imported-')) {
      keyring = new vault.keyringMap.imported(vault);
    }

    if (!keyring) {
      throw new OneKeyInternalError(
        `Keyring Class not found for: accountId=${accountId}`,
      );
    }
    return keyring;
  };

  createVaultInstance = async (options: IVaultOptions) => {
    const network = await this.engine.getNetwork(options.networkId);
    // TODO read from cache
    let vault: VaultBase | null = null;
    debugLogger.engine('createVaultInstance', network, options);
    if (network.impl === IMPL_EVM) {
      vault = new VaultEvm(options);
    }
    if (network.impl === IMPL_CFX) {
      vault = new VaultCfx(options);
    }
    if (!vault) {
      throw new OneKeyInternalError(
        `Vault Class not found for: networkId=${options.networkId}, accountId=${options.accountId}`,
      );
    }

    await vault.init({
      keyringCreator: this.createKeyringInstance,
    });
    // TODO save to cache
    return vault;
  };

  async getVault({
    networkId,
    accountId,
  }: IVaultFactoryOptions): Promise<VaultBase> {
    const options = {
      networkId,
      accountId,
      engine: this.engine,
    };
    const vault: VaultBase = await this.createVaultInstance(options);
    this.lastVault = vault;
    return vault;
  }
}
