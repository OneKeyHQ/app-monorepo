import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityLastWriteData = {
  redux?: Record<string, number>;
  simpleDb?: Record<string, number>;
  dataCleanupLastRun: number;
};

export class SimpleDbEntityLastWrite extends SimpleDbEntityBase<ISimpleDbEntityLastWriteData> {
  entityName = 'lastWrite';

  get #initialData(): ISimpleDbEntityLastWriteData {
    return {
      redux: {},
      simpleDb: {},
      dataCleanupLastRun: Date.now(),
    };
  }

  async getExpiredKeys(
    source: 'redux' | 'simpleDb',
    expiry: number,
    keyPrefix: string,
    now: number = Date.now(),
  ) {
    const data = (await this.getRawData())?.[source] ?? {};
    return Object.entries(data)
      .filter(
        ([key, timestamp]) =>
          now - timestamp > expiry * 1000 &&
          (key === keyPrefix || key.startsWith(`${keyPrefix}.`)),
      )
      .map(([key]) => key);
  }

  async set(
    source: 'redux' | 'simpleDb',
    lastWriteKey: string,
    timestamp: number,
  ) {
    const data = (await this.getRawData()) ?? this.#initialData;
    if (!data[source]) {
      data[source] = {};
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    data[source]![lastWriteKey] = timestamp;
    await this.setRawData(data);
  }

  async multiSet(
    source: 'redux' | 'simpleDb',
    lastWriteKeys: string[],
    timestamp: number,
  ) {
    const data = (await this.getRawData()) ?? this.#initialData;
    if (!data[source]) {
      data[source] = {};
    }
    for (const lastWriteKey of lastWriteKeys) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      data[source]![lastWriteKey] = timestamp;
    }
    await this.setRawData(data);
  }

  async getDataCleanupLastRun() {
    const { dataCleanupLastRun } =
      (await this.getRawData()) ?? this.#initialData;
    return dataCleanupLastRun;
  }

  async setDataCleanupLastRun(now = Date.now()) {
    const data = (await this.getRawData()) ?? this.#initialData;
    data.dataCleanupLastRun = now;
    await this.setRawData(data);
  }
}
