import { acquireHomeStoreControllerLease } from './homeStoreControllerLease';

describe('Home Store controller authority lease', () => {
  it('rejects a second controller for the same scene Store', () => {
    const storeKey = () => undefined;
    const release = acquireHomeStoreControllerLease({
      leaseId: Symbol('first'),
      storeKey,
    });

    expect(() =>
      acquireHomeStoreControllerLease({
        leaseId: Symbol('second'),
        storeKey,
      }),
    ).toThrow(
      'A Home Store scene cannot mount more than one controller authority.',
    );

    release();
  });

  it('isolates independent scene Stores and releases the old authority', () => {
    const firstStore = () => undefined;
    const secondStore = () => undefined;
    const firstLease = Symbol('first');
    const releaseFirst = acquireHomeStoreControllerLease({
      leaseId: firstLease,
      storeKey: firstStore,
    });
    const releaseSecond = acquireHomeStoreControllerLease({
      leaseId: Symbol('second'),
      storeKey: secondStore,
    });

    expect(() =>
      acquireHomeStoreControllerLease({
        leaseId: firstLease,
        storeKey: firstStore,
      }),
    ).not.toThrow();

    releaseFirst();
    expect(() =>
      acquireHomeStoreControllerLease({
        leaseId: Symbol('replacement'),
        storeKey: firstStore,
      }),
    ).not.toThrow();
    releaseSecond();
  });
});
