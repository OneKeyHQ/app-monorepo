import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface INetworkSelectorData {
  pinnedNetworkIds: string[];
}

export class SimpleDbEntityNetworkSelector extends SimpleDbEntityBase<INetworkSelectorData> {
  entityName = 'networkSelector';

  override enableCache = false;

  setPinnedNetworkIds({ networkIds }: { networkIds: string[] }) {
    return this.setRawData(({ rawData }) => ({
      ...rawData,
      pinnedNetworkIds: networkIds,
    }));
  }

  async getPinnedNetworkIds(): Promise<string[] | undefined> {
    const rawData = await this.getRawData();
    return rawData?.pinnedNetworkIds;
  }
}
