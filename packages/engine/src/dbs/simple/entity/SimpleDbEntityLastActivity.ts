import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityLastActivityData = {
  timstamp: number;
};

export class SimpleDbEntityLastActivity extends SimpleDbEntityBase<ISimpleDbEntityLastActivityData> {
  entityName = 'lastActivity';

  async getValue(): Promise<number> {
    const data = await this.getRawData();
    return data?.timstamp ?? Date.now();
  }

  async setValue(timstamp: number) {
    return this.setRawData({ timstamp });
  }
}
