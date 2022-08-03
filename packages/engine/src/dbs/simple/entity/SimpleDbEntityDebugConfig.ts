import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityDebugConfig = {
  fiatEndpoint: string;
};

const defaultConfig = {
  fiatEndpoint: 'https://fiat.onekeycn.com',
};

export class SimpleDbEntityDebugConfig extends SimpleDbEntityBase<ISimpleDbEntityDebugConfig> {
  entityName = 'debugConfig';

  async setData(data: ISimpleDbEntityDebugConfig) {
    const origin = await this.getRawData();
    return this.setRawData({
      ...(origin || {}),
      ...data,
    });
  }

  async getData(key: keyof ISimpleDbEntityDebugConfig): Promise<string> {
    const data = (await this.getRawData()) || defaultConfig;
    return data[key];
  }
}
