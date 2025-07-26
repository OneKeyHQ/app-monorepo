import { appApiClient } from '@onekeyhq/shared/src/appApiClient/appApiClient';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';

import {
  type IApiEndpointConfig,
  apiEndpointConfigPersistAtom,
} from '../states/jotai/atoms/apiEndpointConfig';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceApiEndpointConfig extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async getApiEndpointConfigs(): Promise<IApiEndpointConfig[]> {
    const { configs } = await apiEndpointConfigPersistAtom.get();
    return configs;
  }

  @backgroundMethod()
  public async addApiEndpointConfig(
    config: Omit<IApiEndpointConfig, 'id'>,
  ): Promise<void> {
    await apiEndpointConfigPersistAtom.set((prev) => ({
      configs: [...prev.configs, { ...config, id: generateUUID() }],
    }));
    // Clear client cache to use new endpoints
    appApiClient.clearClientCache();
  }

  @backgroundMethod()
  public async updateApiEndpointConfig(
    id: string,
    updates: Partial<IApiEndpointConfig>,
  ): Promise<void> {
    await apiEndpointConfigPersistAtom.set((prev) => ({
      configs: prev.configs.map((config) =>
        config.id === id ? { ...config, ...updates } : config,
      ),
    }));
    // Clear client cache to use new endpoints
    appApiClient.clearClientCache();
  }

  @backgroundMethod()
  public async deleteApiEndpointConfig(id: string): Promise<void> {
    await apiEndpointConfigPersistAtom.set((prev) => ({
      configs: prev.configs.filter((config) => config.id !== id),
    }));
    // Clear client cache to use new endpoints
    appApiClient.clearClientCache();
  }

  @backgroundMethod()
  public async toggleApiEndpointConfig(
    id: string,
    enabled: boolean,
  ): Promise<void> {
    await this.updateApiEndpointConfig(id, { enabled });
  }

  @backgroundMethod()
  public async getEnabledApiEndpointConfigs(): Promise<IApiEndpointConfig[]> {
    const configs = await this.getApiEndpointConfigs();
    return configs.filter((config) => config.enabled);
  }

  @backgroundMethod()
  public async getApiEndpointByServiceModule(
    serviceModule: EServiceEndpointEnum,
  ): Promise<string | undefined> {
    const configs = await this.getEnabledApiEndpointConfigs();
    const config = configs.find((c) => c.serviceModule === serviceModule);
    return config?.api;
  }
}

export default ServiceApiEndpointConfig;
