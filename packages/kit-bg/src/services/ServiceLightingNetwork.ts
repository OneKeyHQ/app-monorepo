import type VaultLighting from '@onekeyhq/engine/src/vaults/impl/lighting-network/Vault';
import { setIsPasswordLoadedInVault } from '@onekeyhq/kit/src/store/reducers/data';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceLightingNetwork extends ServiceBase {
  @backgroundMethod()
  async createInvoice({
    networkId,
    accountId,
    amount,
    description,
  }: {
    networkId: string;
    accountId: string;
    amount: string;
    description?: string;
  }) {
    const { dispatch, engine, servicePassword } = this.backgroundApi;
    const vault = await engine.getVault({
      networkId,
      accountId,
    });
    const password = await servicePassword.getPassword();
    const passwordLoadedCallback = (isLoaded: boolean) =>
      dispatch(setIsPasswordLoadedInVault(isLoaded));
    const invoice = (vault as VaultLighting).createInvoice(
      amount,
      description,
      password,
      passwordLoadedCallback,
    );
    return invoice;
  }
}
