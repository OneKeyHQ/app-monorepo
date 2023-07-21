import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type UrlInfo = {
  title?: string;
  icon?: string;
};

export type UrlItem = {
  info: UrlInfo;
  timestamp: number;
};

export type ISimpleDbEntityUrlInfo = {
  items: Record<string, UrlItem>;
};

export class SimpleDbEntityUrlInfo extends SimpleDbEntityBase<ISimpleDbEntityUrlInfo> {
  entityName = 'urlInfo';

  maxLen = 200;

  async setItem(key: string, info: UrlInfo): Promise<void> {
    const rawData = await this.getRawData();
    const item = { info, timestamp: Date.now() };

    let newItems = rawData?.items ? { ...rawData.items } : {};
    newItems[key] = item;

    let entries = Object.entries(newItems);
    if (entries.length > this.maxLen) {
      entries = entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      entries = entries.slice(0, this.maxLen);

      newItems = entries.reduce((result, [eKey, eItem]) => {
        result[eKey] = eItem;
        return result;
      }, {} as Record<string, UrlItem>);
    }

    this.setRawData({ ...rawData, items: newItems });
  }

  async getItem(key: string): Promise<UrlInfo | undefined> {
    const rawData = await this.getRawData();
    const items = rawData?.items;
    if (!items) {
      return undefined;
    }
    const urlItem = items[key];
    if (urlItem) {
      urlItem.timestamp = Date.now();
      this.setRawData({ ...rawData, items });
    }
    return urlItem?.info;
  }
}
