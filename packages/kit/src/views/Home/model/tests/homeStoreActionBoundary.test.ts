import type { useHomeStoreIntentActions } from '@onekeyhq/kit/src/states/jotai/contexts/home';

const publicIntentActionKeys: Record<
  keyof ReturnType<typeof useHomeStoreIntentActions>['current'],
  true
> = {
  dispatchHomeIntent: true,
};

describe('Home Store public actions', () => {
  it('exposes only the typed intent dispatcher', () => {
    expect(Object.keys(publicIntentActionKeys)).toEqual(['dispatchHomeIntent']);
  });
});
