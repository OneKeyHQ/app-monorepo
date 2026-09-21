import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_ZCASH } from '@onekeyhq/shared/src/engine/engineConsts';
import { InvalidAddress, NotImplemented } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidateBaseStatus,
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
  }): Promise<IAddressValidateBaseStatus> {
    const { networkId, address } = params;
    if (!networkId) {
      return 'invalid';
    }
    const [local, server] = await Promise.allSettled([
      this.localValidateAddress(params),
      (async () => {
        const isCustomNetwork =
          await this.backgroundApi.serviceNetwork.isCustomNetwork({
            networkId,
          });
        if (isCustomNetwork) {
          throw new NotImplemented(
            'Custom networks have no server address validator',
          );
        }
        return this.serverValidateAddress(params);
      })(),
    ]);

    // The local SDK owns Zcash recipient support. Server indexing support must
    // not veto a receiver that the shipped transaction builder can pay.
    // Both checks still run; allowlist and risk checks remain separate gates.
    if (local.status === 'fulfilled') {
      if (!local.value.isValid) {
        return 'invalid';
      }
      if (networkUtils.getNetworkImpl({ networkId }) === IMPL_ZCASH) {
        return 'valid';
      }
      return server.status === 'fulfilled' && !server.value.data.data.isValid
        ? 'invalid'
        : 'valid';
    }
    defaultLogger.addressInput.validation.failWithUnknownError({
      networkId,
      address,
      serverError: server.status === 'rejected' ? String(server.reason) : '',
      localError: String(local.reason),
    });
    return 'unknown';
  }

  public serverValidateAddress = memoizee(
    async (params: { networkId: string; address: string }) => {
      const { networkId, address } = params;
      try {
        const client = await this.getClient(EServiceEndpointEnum.Wallet);
        const resp = await client.get<{
          data: IAddressValidation;
        }>('/wallet/v1/account/validate-address', {
          params: { networkId, accountAddress: address },
        });
        return resp;
      } catch (error) {
        // Clear cache on network errors to allow retry when network recovers
        this.serverValidateAddress.clear();
        throw error;
      }
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
      promise: true,
    },
  );

  public serverBatchValidateAddress = memoizee(
    async (params: {
      networkIdList: string[];
      accountAddress: string;
    }): Promise<{ isValid: boolean; networkIds: string[] }> => {
      const { networkIdList, accountAddress } = params;
      try {
        const client = await this.getClient(EServiceEndpointEnum.Wallet);
        const resp = await client.post<{
          data: Record<string, IAddressValidation>;
        }>('/wallet/v1/account/validate-address-batch', {
          networkIdList,
          accountAddress,
        });
        const validateResult = resp.data.data || {};
        const validItems = Object.entries(validateResult)
          .map(([networkId, validation]) => ({
            networkId,
            validation,
          }))
          .filter(({ validation }) => validation.isValid);
        return {
          isValid: validItems.length > 0,
          networkIds: validItems.map(({ networkId }) => networkId),
        };
      } catch (error) {
        // Clear cache on network errors to allow retry when network recovers
        this.serverBatchValidateAddress.clear();
        throw error;
      }
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
      promise: true,
    },
  );

  async validateAddressBatch(params: {
    networkIdList: string[];
    accountAddress: string;
  }): Promise<{ isValid: boolean; networkIds: string[] }> {
    const localNetworkIds = params.networkIdList.filter(
      (networkId) => networkUtils.getNetworkImpl({ networkId }) === IMPL_ZCASH,
    );
    const [server, ...local] = await Promise.allSettled([
      this.serverBatchValidateAddress(params),
      ...localNetworkIds.map(async (networkId) => {
        const validation = await this.localValidateAddress({
          networkId,
          address: params.accountAddress,
        });
        return validation.isValid ? networkId : undefined;
      }),
    ]);
    const localMatches = local.flatMap((result) =>
      result.status === 'fulfilled' && result.value ? [result.value] : [],
    );
    if (server.status === 'rejected' && localMatches.length === 0) {
      throw server.reason;
    }
    const networkIds = [
      ...(server.status === 'fulfilled'
        ? server.value.networkIds.filter(
            (networkId) => !localNetworkIds.includes(networkId),
          )
        : []),
      ...localMatches,
    ];
    return { isValid: networkIds.length > 0, networkIds };
  }

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
    try {
      const validation = await vault.validateAddress(address);
      return validation;
    } catch (error) {
      if (error instanceof InvalidAddress) {
        return {
          isValid: false,
          normalizedAddress: '',
          displayAddress: '',
        };
      }
      throw error;
    }
  }

  @backgroundMethod()
  async validateSendAmount({
    accountId,
    networkId,
    amount,
    tokenBalance,
    to,
    isNative,
  }: {
    accountId: string;
    networkId: string;
    amount: string;
    tokenBalance: string;
    to: string;
    isNative?: boolean;
  }): Promise<boolean> {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const validation = await vault.validateSendAmount({
      amount,
      tokenBalance,
      to,
      isNative,
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
