/* eslint-disable @typescript-eslint/no-unused-vars */

import { LocalDbIndexedBase } from './LocalDbIndexedBase';

export class LocalDbIndexed extends LocalDbIndexedBase {
  async reset(): Promise<void> {
    return this.deleteIndexedDb();
  }
}
