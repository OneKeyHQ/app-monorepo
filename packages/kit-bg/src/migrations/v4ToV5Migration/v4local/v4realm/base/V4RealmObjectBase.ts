import Realm from 'realm';

export abstract class V4RealmObjectBase<T> extends Realm.Object {
  static schema: Realm.ObjectSchema;

  abstract get record(): T;
}
