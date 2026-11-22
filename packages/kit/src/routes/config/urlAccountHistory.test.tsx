/** @jest-environment jsdom */
import { type ComponentType, Fragment, type PropsWithChildren } from 'react';

import {
  NavigationContainer,
  StackActions,
  StackRouter,
  TabActions,
  TabRouter,
  createNavigationContainerRef,
  createNavigatorFactory,
  useIsFocused,
  useNavigation,
  useNavigationBuilder,
} from '@react-navigation/native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { urlAccountNavigation } from '@onekeyhq/kit/src/views/Home/pages/urlAccount/urlAccountUtils';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import { getUrlAccountHistoryBackRouteKey } from './urlAccountHistory';

jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({ isNative: false }));

type ITestNavigator = {
  Navigator: ComponentType<PropsWithChildren>;
  Screen: ComponentType<{ name: string; component: ComponentType }>;
};

function createTestNavigator(router: typeof StackRouter | typeof TabRouter) {
  function TestNavigator(props: Parameters<typeof useNavigationBuilder>[1]) {
    const { state, descriptors, NavigationContent } = useNavigationBuilder(
      router,
      props,
    );
    return (
      <NavigationContent>
        {state.routes.map(({ key }) => (
          <Fragment key={key}>{descriptors[key].render()}</Fragment>
        ))}
      </NavigationContent>
    );
  }
  return createNavigatorFactory(TestNavigator)() as ITestNavigator;
}

const RootStack = createTestNavigator(StackRouter);
const MainTabs = createTestNavigator(TabRouter);
const HomeStack = createTestNavigator(StackRouter);

function EmptyScreen() {
  return null;
}

function AddressScreen() {
  const navigation = useNavigation<IAppNavigation>();
  const isFocused = useIsFocused();
  return isFocused ? (
    <button
      type="button"
      onClick={() => urlAccountNavigation.goBack(navigation)}
    >
      Back to wallet
    </button>
  ) : null;
}

function HomeScreen() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen name={ETabHomeRoutes.TabHome} component={EmptyScreen} />
      <HomeStack.Screen
        name={ETabHomeRoutes.TabHomeUrlAccountPage}
        component={AddressScreen}
      />
    </HomeStack.Navigator>
  );
}

function MainScreen() {
  return (
    <MainTabs.Navigator>
      <MainTabs.Screen name={ETabRoutes.Market} component={EmptyScreen} />
      <MainTabs.Screen name={ETabRoutes.Home} component={HomeScreen} />
    </MainTabs.Navigator>
  );
}

beforeAll(() => {
  // The shared Jest setup replaces the window listener with a stub.
  globalThis.addEventListener =
    EventTarget.prototype.addEventListener.bind(globalThis);
});

afterEach(() => jest.restoreAllMocks());

it.each([
  { scenario: 'existing Home', replaceHome: false },
  { scenario: 'Home replaced by address search', replaceHome: true },
])(
  'returns to Home with $scenario and keeps browser Back in sync',
  async ({ replaceHome }) => {
    const navigation = createNavigationContainerRef();
    const extensionPath = '/ui-expand-tab.html';
    globalThis.history.pushState(null, '', extensionPath);
    render(
      <NavigationContainer
        ref={navigation}
        direction="ltr"
        documentTitle={{ enabled: false }}
        linking={{
          prefixes: [],
          getStateFromPath: () => undefined,
          getPathFromState: () => extensionPath,
          getHistoryBackRouteKey: getUrlAccountHistoryBackRouteKey,
        }}
      >
        <RootStack.Navigator>
          <RootStack.Screen name={ERootRoutes.Main} component={MainScreen} />
        </RootStack.Navigator>
      </NavigationContainer>,
    );
    await waitFor(() => expect(navigation.isReady()).toBe(true));
    expect(navigation.getCurrentRoute()?.name).toBe(ETabRoutes.Market);
    const marketEntry: unknown = globalThis.history.state;

    await act(async () =>
      navigation.dispatch(TabActions.jumpTo(ETabRoutes.Home)),
    );
    const addressRoute = ETabHomeRoutes.TabHomeUrlAccountPage;
    const firstAddress = { address: 'A' };
    await act(async () =>
      navigation.dispatch(
        replaceHome
          ? StackActions.replace(addressRoute, firstAddress)
          : StackActions.push(addressRoute, firstAddress),
      ),
    );
    await act(async () =>
      navigation.dispatch(StackActions.push(addressRoute, { address: 'B' })),
    );
    expect(navigation.getCurrentRoute()?.params).toEqual({ address: 'B' });

    const replaceHistoryEntry = jest.spyOn(globalThis.history, 'replaceState');
    fireEvent.click(screen.getByRole('button', { name: 'Back to wallet' }));
    expect(navigation.getCurrentRoute()?.name).toBe(ETabHomeRoutes.TabHome);
    await waitFor(() => expect(replaceHistoryEntry).toHaveBeenCalled());

    await act(async () => {
      const popState = new Promise<void>((resolve) => {
        globalThis.addEventListener('popstate', () => resolve(), {
          once: true,
        });
      });
      globalThis.history.back();
      await popState;
    });
    expect(globalThis.history.state).toEqual(marketEntry);
    expect(navigation.getCurrentRoute()?.name).toBe(ETabRoutes.Market);
  },
);
