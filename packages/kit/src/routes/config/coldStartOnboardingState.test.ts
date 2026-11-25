import { StackRouter } from '@react-navigation/routers';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';

import type { NavigationState } from '@react-navigation/native';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/utils/walletPresenceHintUtils', () => ({
  shouldColdStartIntoOnboardingSync: () => true,
}));
const mockEmit = jest.fn<void, unknown[]>();
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: { emit: (...args: unknown[]) => mockEmit(...args) },
  EAppEventBusNames: { ColdStartOnboardingReady: 'ColdStartOnboardingReady' },
}));

function rootState(routes: NavigationState['routes']): NavigationState {
  return {
    type: 'stack',
    stale: false,
    key: 'root',
    index: routes.length - 1,
    routeNames: [ERootRoutes.Main, ERootRoutes.Onboarding],
    routes,
  };
}

const main = { name: ERootRoutes.Main, key: 'main' };

beforeEach(() => {
  jest.clearAllMocks();
});

it('releases the onboarding wait if another route replaces it before mount', () => {
  jest.isolateModules(() => {
    const state = jest.requireActual<
      typeof import('./coldStartOnboardingState')
    >('./coldStartOnboardingState');
    const initialState = state.getColdStartOnboardingInitialState();
    if (!initialState) {
      throw new OneKeyLocalError('missing cold-start navigation state');
    }
    const stack = StackRouter({ initialRouteName: ERootRoutes.Main });
    const mounted = stack.getRehydratedState(
      { index: initialState.index, routes: initialState.routes, stale: true },
      {
        routeNames: [ERootRoutes.Main, ERootRoutes.Onboarding],
        routeParamList: {},
        routeGetIdList: {},
      },
    );
    state.trackColdStartOnboardingNavigation(mounted);
    expect(state.isColdStartOnboardingReady()).toBe(false);
    expect(state.wasColdStartOnboardingSeeded()).toBe(true);

    state.trackColdStartOnboardingNavigation(rootState([main]));
    expect(state.isColdStartOnboardingReady()).toBe(true);
    expect(state.wasColdStartOnboardingSeeded()).toBe(true);
    expect(mockEmit).toHaveBeenCalledWith(
      EAppEventBusNames.ColdStartOnboardingReady,
      undefined,
    );
    expect(state.getColdStartOnboardingInitialState()).toBeUndefined();
  });
});

it('releases the wait without claiming a restored route was seeded', () => {
  jest.isolateModules(() => {
    const state = jest.requireActual<
      typeof import('./coldStartOnboardingState')
    >('./coldStartOnboardingState');
    state.trackColdStartOnboardingNavigation(
      rootState([main, { key: 'restored', name: ERootRoutes.Onboarding }]),
    );
    expect(state.isColdStartOnboardingReady()).toBe(true);
    expect(state.wasColdStartOnboardingSeeded()).toBe(false);
  });
});
