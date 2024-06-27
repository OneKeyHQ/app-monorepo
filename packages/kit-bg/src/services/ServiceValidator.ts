import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidateStatus,
  IAddressValidation,
} from '@onekeyhq/shared/types/address';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceValidator extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async validateAddress(params: {
    networkId: string;
    address: string;
  }): Promise<IAddressValidateStatus> {
    // Both server and local validation are required. If server-level validation fails due to a network issue, we will fall back to local validation."
    const { networkId, address } = params;
    try {
      const resp = await this.serverValidateAddress(params);
      const serverValid = resp.data.data.isValid;
      if (!serverValid) {
        return 'invalid';
      }
      const localValidation = await this.localValidateAddress({
        networkId,
        address,
      });
      return localValidation.isValid ? 'valid' : 'invalid';
    } catch (serverError) {
      try {
        const localValidation = await this.localValidateAddress({
          networkId,
          address,
        });
        return localValidation.isValid ? 'valid' : 'invalid';
      } catch (localError) {
        console.error('failed to validateAddress', serverError, localError);
        defaultLogger.addressInput.validation.failWithUnknownError({
          networkId,
          address,
          serverError: (serverError as Error).message,
          localError: (localError as Error).message,
        });
        return 'unknown';
      }
    }
  }

  public serverValidateAddress = memoizee(
    async (params: { networkId: string; address: string }) => {
      const { networkId, address } = params;
      const client = await this.getClient(EServiceEndpointEnum.Wallet);
      const resp = await client.get<{
        data: IAddressValidation;
      }>('/wallet/v1/account/validate-address', {
        params: { networkId, accountAddress: address },
      });
      return resp;
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
    },
  );

  @backgroundMethod()
  async localValidateAddress({
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
