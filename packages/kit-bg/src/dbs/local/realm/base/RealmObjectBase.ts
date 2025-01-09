import Realm from 'realm';

export abstract class RealmObjectBase<T> extends Realm.Object {
  static schema: Realm.ObjectSchema;

  abstract get record(): T;
}
