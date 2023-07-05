import { SimpleDbEntityBase } from './SimpleDbEntityBase';

import type { IInscriptionHistory } from '../../../vaults/impl/btc/inscribe/types';

export type ISimpleDbEntityInscribeData = {
  orderLists: IInscriptionHistory[];
};

export class SimpleDbEntityInscribe extends SimpleDbEntityBase<ISimpleDbEntityInscribeData> {
  entityName = 'Inscribe';

  override enableCache = false;

  async savaItem(data: IInscriptionHistory): Promise<void> {
    const rawData = await this.getRawData();
    const orderLists = rawData?.orderLists ?? [];
    this.setRawData({ ...rawData, orderLists: orderLists.concat(data) });
  }

  async getItems(): Promise<IInscriptionHistory[]> {
    const rawData = await this.getRawData();
    return rawData?.orderLists ?? [];
  }
}
