import Realm from 'realm';

class CredentialMapSchema extends Realm.Object {
  public id!: string;

  public credentialMap!: string;

  public static schema: Realm.ObjectSchema = {
    name: 'CredentialMap',
    primaryKey: 'id',
    properties: {
      id: 'string',
      credentialMap: 'string',
    },
  };
}
export { CredentialMapSchema };
