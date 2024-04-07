import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface INetworkSelectorData {
  networkIds: string[];
}

export class SimpleDbEntityNetworkSelector extends SimpleDbEntityBase<INetworkSelectorData> {
  entityName = 'networkSelector';

  override enableCache = false;

  setPinnedNetworkIds({ networkIds }: { networkIds: string[] }) {
    return this.setRawData(({ rawData }) => ({
      networkIds,
      ...rawData?.networkIds,
    }));
  }

  async getPinnedNetworkIds(): Promise<string[] | undefined> {
    const rawData = await this.getRawData();
    return rawData?.networkIds;
  }
}
