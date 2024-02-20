import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { getVaultSettings } from '../../vaults/settings';
import ServiceBase from '../ServiceBase';

@backgroundClass()
class ServiceNetwork extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async sampleMethod() {
    console.log('sampleMethod');
    return 'sampleMethod';
  }

  @backgroundMethod()
  async getAllNetworks(): Promise<{ networks: IServerNetwork[] }> {
    // TODO save to simpleDB
    const networks = getPresetNetworks();
    return Promise.resolve({ networks });
  }

  @backgroundMethod()
  async getAllNetworkIds(): Promise<{ networkIds: string[] }> {
    const { networks } = await this.getAllNetworks();
    const networkIds = networks.map((n) => n.id);
    return {
      networkIds,
    };
  }

  @backgroundMethod()
  async getNetwork({
    networkId,
  }: {
    networkId: string;
  }): Promise<IServerNetwork> {
    const { networks } = await this.getAllNetworks();
    const network = networks.find((n) => n.id === networkId);
    if (!network) {
      throw new Error(`getNetwork ERROR: Network not found: ${networkId}`);
    }
    return network;
  }

  @backgroundMethod()
  async getNetworksByIds({
    networkIds,
  }: {
    networkIds: string[];
  }): Promise<{ networks: IServerNetwork[] }> {
    const { networks } = await this.getAllNetworks();
    return {
      networks: networks.filter((n) => networkIds.includes(n.id)),
    };
  }

  @backgroundMethod()
  async getNetworksByImpls({
    impls,
  }: {
    impls: string[];
  }): Promise<{ networks: IServerNetwork[] }> {
    const { networks } = await this.getAllNetworks();
    return {
      networks: networks.filter((n) => impls.includes(n.impl)),
    };
  }

  @backgroundMethod()
  async getNetworkIdsByImpls({
    impls,
  }: {
    impls: string[];
  }): Promise<{ networkIds: string[] }> {
    const { networks } = await this.getNetworksByImpls({ impls });
    return {
      networkIds: networks.map((n) => n.id),
    };
  }

  @backgroundMethod()
  async getVaultSettings({ networkId }: { networkId: string }) {
    const settings = await getVaultSettings({ networkId });
    return settings;
  }

  @backgroundMethod()
  async groupNetworks({
    networks,
    searchKey,
  }: {
    networks: IServerNetwork[];
    searchKey?: string;
  }) {
    let input = networks;
    if (searchKey) {
      input = await this.filterNetworks({ networks, searchKey });
    }
    const data = input.reduce((result, item) => {
      const firstLetter = item.name[0].toUpperCase();
      if (!result[firstLetter]) {
        result[firstLetter] = [];
      }
      result[firstLetter].push(item);

      return result;
    }, {} as Record<string, IServerNetwork[]>);
    return Object.entries(data)
      .map(([key, items]) => ({ title: key, data: items }))
      .sort((a, b) => a.title.charCodeAt(0) - b.title.charCodeAt(0));
  }

  @backgroundMethod()
  async filterNetworks({
    networks,
    searchKey,
  }: {
    networks: IServerNetwork[];
    searchKey: string;
  }) {
    const key = searchKey.toLowerCase();
    if (key) {
      return networks.filter(
        (o) =>
          o.name.toLowerCase().includes(key) ||
          o.shortname.toLowerCase().includes(key),
      );
    }
    return networks;
  }

  @backgroundMethod()
  async getNetworkNames() {
    const { networks: allNetworks } = await this.getAllNetworks();
    return allNetworks.reduce((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {} as Record<string, string>);
  }

  async containsNetwork({
    impls,
    networkId,
  }: {
    impls?: string[];
    networkId: string;
  }) {
    let networkIds: string[];
    if (impls) {
      ({ networkIds } = await this.getNetworkIdsByImpls({ impls }));
    } else {
      ({ networkIds } = await this.getAllNetworkIds());
    }
    return networkIds.includes(networkId);
  }
}

export default ServiceNetwork;
