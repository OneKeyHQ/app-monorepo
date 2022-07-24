import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export type ISimpleDbEntityPwKeyData = {
  key: string;
};

export class SimpleDbEntityPwKey extends SimpleDbEntityBase<ISimpleDbEntityPwKeyData> {
  entityName = 'pwkey';
}
