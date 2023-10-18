import Realm from 'realm';

class CredentialSchema extends Realm.Object {
  public id!: string;

  public credential!: string;

  public static schema: Realm.ObjectSchema = {
    name: 'Credential',
    primaryKey: 'id',
    properties: {
      id: 'string',
      credential: 'string',
    },
  };
}
export { CredentialSchema };
