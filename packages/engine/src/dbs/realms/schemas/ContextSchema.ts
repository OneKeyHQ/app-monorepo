import Realm from 'realm';

class ContextSchema extends Realm.Object {
  public id!: string;

  public nextHD!: number;

  public verifyString!: string;

  public static schema: Realm.ObjectSchema = {
    name: 'Context',
    primaryKey: 'id',
    properties: {
      id: 'string',
      nextHD: 'int',
      verifyString: 'string',
    },
  };
}
export { ContextSchema };
