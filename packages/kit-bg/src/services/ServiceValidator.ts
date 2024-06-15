import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IAddressValidation } from '@onekeyhq/shared/types/address';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceValidator extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async validateAddress({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }): Promise<IAddressValidation> {
    noopObject(networkId);
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const validation = await vault.validateAddress(address);
    return validation;
  }

  @backgroundMethod()
  async validateSendAmount({
    accountId,
    networkId,
    amount,
    tokenBalance,
    to,
  }: {
    accountId: string;
    networkId: string;
    amount: string;
    tokenBalance: string;
    to: string;
  }): Promise<boolean> {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const validation = await vault.validateSendAmount({
      amount,
      tokenBalance,
      to,
    });
    return validation;
  }

  @backgroundMethod()
  async validateAmountInputShown({
    networkId,
    toAddress,
  }: {
    networkId: string;
    toAddress: string;
  }) {
    const vault = await vaultFactory.getChainOnlyVault({ networkId });
    const validation = await vault.validateAmountInputShown({ toAddress });
    return validation;
  }
}

export default ServiceValidator;
